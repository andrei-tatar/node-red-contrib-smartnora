import { OnOffDevice, VolumeDevice } from '@andrei-tatar/nora-firebase-common';
import { firstValueFrom, Subject } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { getId, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-speaker', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject<void>();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const deviceConfig = noraConfig.setCommon<VolumeDevice & OnOffDevice>({
            id: getId(config),
            type: 'action.devices.types.SPEAKER',
            traits: ['action.devices.traits.Volume', 'action.devices.traits.OnOff'] as never,
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
            noraSpecific: {
            },
            attributes: {
                volumeCanMuteAndUnmute: false,
                volumeMaxLevel: 100,
                levelStepSize: parseInt(config.step, 10) || 1,
            },
        }, config);

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, ctx)
            .pipe(
                switchMap(connection => connection.withDevice(deviceConfig, ctx)),
                withLocalExecution(noraConfig),
                singleton(),
                takeUntil(close$),
            );

        device$.pipe(
            switchMap(d => d.state$),
            tap(state => notifyState(state)),
            takeUntil(close$),
        ).subscribe();

        device$.pipe(
            switchMap(d => d.stateUpdates$),
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
            try {
                const device = await firstValueFrom(device$);
                await device.updateState(msg?.payload, [{
                    from: 'volume',
                    to: 'currentVolume',
                }]);
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: (VolumeDevice & OnOffDevice)['state']) {
            ctx.state$.next(`(${state.on ? 'on' : 'off'}:${state.currentVolume})`);
        }
    });
};
