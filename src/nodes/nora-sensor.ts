import { Device, HumiditySettingDevice, isHumiditySetting, isTemperatureControl, SensorStateDevice, TemperatureControlDevice } from '@andrei-tatar/nora-firebase-common';
import { firstValueFrom, Subject } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { getId, R, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-sensor', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject<void>();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const deviceConfig = noraConfig.setCommon<Device>({
            id: getId(config),
            type: 'action.devices.types.SENSOR',
            traits: [] as never,
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            state: {
                online: true,
            },
            noraSpecific: {
            },
            attributes: {
            },
        }, config);

        if (config.temperature) {
            deviceConfig.traits.push('action.devices.traits.TemperatureControl');
            if (isTemperatureControl(deviceConfig)) {
                const temperatureControlAttributes: TemperatureControlDevice['attributes'] = {
                    queryOnlyTemperatureControl: true,
                    temperatureUnitForUX: config.unit,
                    temperatureRange: {
                        minThresholdCelsius: -100,
                        maxThresholdCelsius: 100,
                    },
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...temperatureControlAttributes,
                };
            }
        }

        if (config.humidity) {
            deviceConfig.traits.push('action.devices.traits.HumiditySetting');
            if (isHumiditySetting(deviceConfig)) {
                const humiditySettingAttributes: HumiditySettingDevice['attributes'] = {
                    queryOnlyHumiditySetting: true,
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...humiditySettingAttributes,
                };
            }
        }

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

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }
            try {
                const device = await firstValueFrom(device$);
                await device.updateState(msg?.payload, [{
                    from: 'temperature',
                    to: 'temperatureAmbientCelsius',
                }, {
                    from: 'humidity',
                    to: 'humidityAmbientPercent',
                }]);
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: Device['state']) {
            const states: string[] = [];
            if (isHumidityState(state)) {
                states.push(R`H:${state.humidityAmbientPercent}%`);
            }
            if (isTemperatureState(state)) {
                states.push(R`T:${state.temperatureAmbientCelsius}C`);
            }
            ctx.state$.next(states.join(' '));
        }

        function isHumidityState(state: any): state is HumiditySettingDevice['state'] {
            return isHumiditySetting(deviceConfig) && 'humidityAmbientPercent' in state;
        }

        function isTemperatureState(state: any): state is TemperatureControlDevice['state'] {
            return isTemperatureControl(deviceConfig) && 'temperatureAmbientCelsius' in state;
        }
    });
};
