import { validateIndividual, WebpushNotification } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { getId } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-notify', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const identifier = `${getId(config)}|${noraConfig.group}`;

        const close$ = new Subject();
        const connection$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, this)
            .pipe(
                publishReplay(1),
                refCount(),
                takeUntil(close$),
            );

        connection$.pipe(
            switchMap(c => c.watchForActions(identifier)),
            takeUntil(close$),
        ).subscribe(action => {
            this.send({ payload: action });
        });

        this.on('input', async msg => {
            try {
                const notification: WebpushNotification = {
                    title: config.title,
                    body: config.body,
                    icon: config.icon,
                    ...msg.payload ?? {},
                };
                const result = validateIndividual('notification', notification);
                if (result.valid) {
                    if (notification.actions?.length) {
                        notification.data ??= {};
                        notification.data.sender = identifier;
                    }

                    const connection = await connection$.pipe(first()).toPromise();
                    await connection.sendNotification(notification);
                } else {
                    this.warn(`Not a valid notification object: ${JSON.stringify(result.errors)}`);
                }
            } catch (err) {
                this.warn(err);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });
    });
};
