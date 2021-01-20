import { OpenCloseDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, skip, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { getId } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-blinds', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const stateString$ = new Subject<string>();

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, this, stateString$)
            .pipe(
                switchMap(connection => connection.withDevice<OpenCloseDevice>({
                    id: getId(config),
                    type: 'action.devices.types.BLINDS',
                    traits: ['action.devices.traits.OpenClose'],
                    name: {
                        name: config.devicename,
                    },
                    roomHint: config.roomhint,
                    willReportState: true,
                    noraSpecific: {
                    },
                    state: {
                        online: true,
                        openPercent: 100,
                    },
                    attributes: {
                    },
                })),
                publishReplay(1),
                refCount(),
                takeUntil(close$),
            );

        device$.pipe(
            switchMap(d => d.state$),
            tap(state => notifyState(state)),
            skip(1),
            takeUntil(close$),
        ).subscribe(state => {
            if ('openPercent' in state) {
                this.send({
                    payload: {
                        openPercent: adjustPercent(state.openPercent),
                    },
                    topic: config.topic
                });
            }
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }
            try {
                const device = await device$.pipe(first()).toPromise();
                await device.updateStateSafer(msg?.payload);
            } catch (err) {
                this.warn(err);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: OpenCloseDevice['state']) {
            stateString$.next(`(${'openPercent' in state && adjustPercent(state.openPercent)}%)`);
        }

        function adjustPercent(openPercent: number) {
            return config.invert ? 100 - openPercent : openPercent;
        }
    });
};

