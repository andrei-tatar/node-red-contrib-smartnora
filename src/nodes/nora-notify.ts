import { validateIndividual, WebpushNotification } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { getSafeUpdate } from '../firebase/safe-update';
import { HttpError } from '../firebase/sync';
import { getId, getValue } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-notify', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const identifier = `${getId(config)}|${noraConfig.group}`;
        const configActions: { p: string, v: string, vt: string }[] | undefined = config.actions;

        const close$ = new Subject();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const connection$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, ctx)
            .pipe(
                publishReplay(1),
                refCount(),
                takeUntil(close$),
            );

        connection$.pipe(
            switchMap(c => c.watchForActions(identifier)),
            takeUntil(close$),
        ).subscribe(action => {
            const actionIndex = parseInt(action, 10);
            if (configActions?.length && actionIndex >= 0 && actionIndex < configActions.length) {
                const { v, vt } = configActions[actionIndex];
                const payload = getValue(RED, this, v, vt);
                this.send({
                    payload,
                    topic: config.topic,
                });
            }
        });

        this.on('input', async msg => {
            try {
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

                if (configActions?.length) {
                    notification.actions = configActions.map(({ p }, index) => ({
                        title: p,
                        action: `${index}`,
                    }));
                    notification.data ??= {};
                    notification.data.sender = identifier;
                } else {
                    delete notification.actions;
                }

                const connection = await connection$.pipe(first()).toPromise();
                await connection.sendNotification(notification);
                ctx.error$.next(null);
            } catch (err) {
                if (err instanceof HttpError && err.statusCode === 400) {
                    ctx.error$.next(err.content);
                } else {
                    this.warn(`while sending notification ${err.message}: ${err.stack}`);
                }
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });
    });
};
