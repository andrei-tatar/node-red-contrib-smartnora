import { SpeakerDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, skip, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { getId } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-speaker', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const stateString$ = new Subject<string>();

        const device$ = FirebaseConnection
            .fromConfig(noraConfig, this, stateString$)
            .pipe(
                switchMap(connection => connection.createDevice<SpeakerDevice>({
                    id: getId(config),
                    type: 'action.devices.types.SPEAKER',
                    traits: ['action.devices.traits.Volume', 'action.devices.traits.OnOff'],
                    name: {
                        name: config.devicename,
                    },
                    roomHint: config.roomhint,
                    willReportState: true,
                    state: {
                        on: false,
                        online: true,
                        currentVolume: 50,
                        isMuted: false,
                    },
                    attributes: {
                        volumeCanMuteAndUnmute: false,
                        volumeMaxLevel: 100,
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
        ).subscribe((state) => {
            this.send({
                payload: {
                    on: state.on,
                    volume: state.currentVolume,
                },
                topic: config.topic
            });
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }

            const device = await device$.pipe(first()).toPromise();
            await device.updateStateSafer(msg?.payload);
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: SpeakerDevice['state']) {
            stateString$.next(`(${state.on ? 'on' : 'off'}:${state.currentVolume})`);
        }
    });
};

