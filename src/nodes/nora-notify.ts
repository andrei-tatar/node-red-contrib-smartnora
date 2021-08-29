import { validateIndividual, WebpushNotification } from '@andrei-tatar/nora-firebase-common';
import { concat, defer, EMPTY, firstValueFrom, Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../nora/connection';
import { DeviceContext } from '../nora/device-context';
import { getSafeUpdate } from '../nora/safe-update';
import { getClose, getId, getValue, handleNodeInput } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-notify', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const identifier = `${getId(config)}|${noraConfig.group}`;
        const configActions: { p: string; v: string; vt: string; d?: boolean }[] | undefined = config.actions;
        const actions = configActions?.map(({ p: title, v: value, vt: type }, index) => ({
            title,
            action: type === 'link' ? value : `${index}`,
        }));
        const defaultAction = actions?.[configActions?.findIndex(c => !!c.d) ?? -1]?.action;

        const close$ = getClose(this);
        const notificationSent$ = new Subject<null>();
        const ctx = new DeviceContext(this);
        ctx.startUpdating(close$);

        const connection$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, ctx)
            .pipe(
                singleton(),
                takeUntil(close$),
            );

        connection$.pipe(
            switchMap(c => c.watchForActions(identifier)),
            takeUntil(close$),
        ).subscribe(action => {
            const actionIndex = parseInt(action, 10);
            if (configActions?.length && actionIndex >= 0 && actionIndex < configActions.length) {
                const { v: value, vt: valuetype } = configActions[actionIndex];
                const payload = getValue(RED, this, value, valuetype);
                this.send({
                    payload,
                    topic: config.topic,
                });
            }
        });

        notificationSent$.pipe(
            switchMap(_ => {
                ctx.status$.next('sent');
                ctx.local$.next(true);
                return concat(
                    timer(1000),
                    defer(() => {
                        ctx.status$.next(null);
                        ctx.local$.next(false);
                        return EMPTY;
                    })
                );
            }),
            takeUntil(close$),
        ).subscribe();

        handleNodeInput({
            node: this,
            handler: async msg => {
                const notification: WebpushNotification = {
                    title: config.title,
                    body: config.body,
                    icon: config.icon,
                    tag: config.tag || undefined,
                    actions: undefined,
                };

                getSafeUpdate({
                    update: msg.payload ?? {},
                    safeUpdateObject: notification,
                    currentState: notification,
                    isValid: () => validateIndividual('notification', notification).valid,
                    warn: (propName) => this.warn(`ignoring property ${propName}`),
                });

                if (actions?.length) {
                    notification.actions = actions;
                    notification.data = {
                        ...notification.data,
                        sender: identifier,
                        defaultAction: defaultAction,
                    };
                } else {
                    delete notification.actions;
                }

                const connection = await firstValueFrom(connection$);
                try {
                    ctx.error$.next(null);
                    await connection.sendNotification(notification);
                    notificationSent$.next(null);
                } catch (err) {
                    ctx.error$.next('Too many notifications');
                }
            },
        });
    });
};
