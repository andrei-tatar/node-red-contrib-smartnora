import { Device, HumiditySettingDevice, isHumiditySetting, isTemperatureControl, TemperatureControlDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-sensor', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const deviceConfig: Omit<Device, 'id'> = {
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
        };

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

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [];
                if (isHumidityState(state)) {
                    statuses.push(`H:${state.humidityAmbientPercent}%`);
                }
                if (isTemperatureState(state)) {
                    statuses.push(`T:${state.temperatureAmbientCelsius}C`);
                }
                update(statuses.join(' '));
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, [{
                    from: 'temperature',
                    to: 'temperatureAmbientCelsius',
                }, {
                    from: 'humidity',
                    to: 'humidityAmbientPercent',
                }]);
            },
        });

        function isHumidityState(state: any): state is HumiditySettingDevice['state'] {
            return isHumiditySetting(deviceConfig) && 'humidityAmbientPercent' in state;
        }

        function isTemperatureState(state: any): state is TemperatureControlDevice['state'] {
            return isTemperatureControl(deviceConfig) && 'temperatureAmbientCelsius' in state;
        }
    });
};
