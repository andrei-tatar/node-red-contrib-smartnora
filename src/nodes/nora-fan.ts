import { FanSpeedDevice, OnOffDevice } from '@andrei-tatar/nora-firebase-common';
import { firstValueFrom, Subject } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { getId, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-fan', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject<void>();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const speeds: { n: string, v: string }[] = config.speeds;

        const deviceConfig = noraConfig.setCommon<FanSpeedDevice & OnOffDevice>({
            id: getId(config),
            type: 'action.devices.types.FAN',
            traits: ['action.devices.traits.OnOff', 'action.devices.traits.FanSpeed'] as never,
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            noraSpecific: {
            },
            state: {
                on: false,
                online: true,
                ...(config.percentcontrol
                    ? { currentFanSpeedPercent: 100 }
                    : { currentFanSpeedSetting: speeds[0].v }),
            },
            attributes: {
                ...(config.percentcontrol
                    ? {
                        supportsFanSpeedPercent: true,
                    }
                    : {
                        supportsFanSpeedPercent: false,
                        availableFanSpeeds: {
                            speeds: speeds.map(s => ({
                                speed_name: s.v.trim(),
                                speed_values: [{
                                    speed_synonym: s.n.split(',').map(v => v.trim()),
                                    lang: config.language,
                                }],
                            })),
                            ordered: true,
                        },
                    })
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
        ).subscribe(state => {
            this.send({
                payload: {
                    on: state.on,
                    speed: 'currentFanSpeedPercent' in state
                        ? state.currentFanSpeedPercent
                        : state.currentFanSpeedSetting,
                },
                topic: config.topic
            });
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }

            try {
                if (!config.percentcontrol &&
                    (msg?.payload?.speed ?? undefined) !== undefined &&
                    !speeds.find(s => s.v === msg.payload.speed)) {
                    this.warn(`invalid fan speed: ${msg.payload.speed}`);
                    return;
                }

                const device = await firstValueFrom(device$);
                await device.updateState(msg?.payload, [{
                    from: 'speed',
                    to: config.percentcontrol ? 'currentFanSpeedPercent' : 'currentFanSpeedSetting'
                }]);
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: (OnOffDevice & FanSpeedDevice)['state']) {
            const speed = 'currentFanSpeedPercent' in state
                ? `${state.currentFanSpeedPercent}%`
                : state.currentFanSpeedSetting;
            ctx.state$.next(`(${state.on ? 'on' : 'off'} - ${speed})`);
        }
    });
};

