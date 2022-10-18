import { validateIndividual, WebpushNotification } from '@andrei-tatar/nora-firebase-common';
import { concat, defer, EMPTY, firstValueFrom, Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../nora/connection';
import { DeviceContext } from '../nora/device-context';
import { getSafeUpdate } from '../nora/safe-update';
import { RateLimitingError } from '../nora/sync';
import { getClose, getId, getValue, handleNodeInput } from './util';

const JSON_ACTION_PREFIX = 'json:';
const LINK_ACTION_PREFIX = 'https://';

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
        }))?.splice(0, 3);
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
            if (action.startsWith(JSON_ACTION_PREFIX)) {
                const actionJson = action.substring(JSON_ACTION_PREFIX.length);
                this.send({
                    payload: JSON.parse(actionJson),
                    topic: config.topic,
                });
            } else {
                const actionIndex = parseInt(action, 10);
                if (configActions?.length && actionIndex >= 0 && actionIndex < configActions.length) {
                    const { v: value, vt: valuetype } = configActions[actionIndex];
                    const payload = getValue(RED, this, value, valuetype);
                    this.send({
                        payload,
                        topic: config.topic,
                    });
                }
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
                    actions: [],
                    data: {
                        close: (config.closeNotification || msg.payload?.close) ?? undefined,
                    },
                };

                delete msg?.payload?.close;

                if (typeof msg.payload === 'object' && Array.isArray(msg.payload.actions) && msg.payload.actions.length) {
                    msg.payload.actions = msg.payload.actions.map((v: any) => ({
                        ...v,
                        action: v.action.startsWith(LINK_ACTION_PREFIX)
                            ? v.action
                            : JSON_ACTION_PREFIX + JSON.stringify(v.action)
                    }));
                    msg.payload.data = {
                        ...msg.payload.data,
                        defaultAction: msg.payload.actions[0].action,
                    };
                }

                getSafeUpdate({
                    update: msg.payload ?? {},
                    safeUpdateObject: notification,
                    currentState: notification,
                    isValid: () => validateIndividual('notification', notification).valid,
                    warn: (propName) => this.warn(`ignoring property ${propName}`),
                });

                if (actions?.length && !notification.actions?.length) {
                    notification.actions = actions;
                    notification.data = {
                        ...notification.data,
                        defaultAction,
                    };
                }

                if (notification.actions?.length) {
                    notification.data = {
                        ...notification.data,
                        sender: identifier,
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
                    if (err instanceof RateLimitingError) {
                        ctx.error$.next('Too many notifications');
                    } else {
                        throw err;
                    }
                }
            },
        });
    });
};
