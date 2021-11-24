import {
    Device, HumiditySettingDevice, isHumiditySetting, isSensorState as isSensorDevice,
    isTemperatureControl, SensorStateDevice, TemperatureControlDevice
} from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-sensor', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

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

        if (config.sensorSupport) {
            const NUMERIC: Array<[string, string[]]> = [
                ['PARTS_PER_MILLION', ['CarbonMonoxideLevel', 'SmokeLevel', 'CarbonDioxideLevel']],
                ['AQI', ['AirQuality']],
                ['MICROGRAMS_PER_CUBIC_METER', ['PM2.5', 'PM10']],
                ['PARTS_PER_MILLION', ['VolatileOrganicCompounds']],
                ['PERCENTAGE', ['FilterLifeTime', 'PreFilterLifeTime', 'HEPAFilterLifeTime', 'Max2FilterLifeTime']],
            ];

            deviceConfig.traits.push('action.devices.traits.SensorState');
            if (isSensorDevice(deviceConfig)) {
                const numericType = NUMERIC.find(n => n[1].includes(config.sensorType))?.[0];
                deviceConfig.attributes.sensorStatesSupported = [{
                    name: config.sensorType,
                    ...(config.sensorStates?.length ? {
                        descriptiveCapabilities: {
                            availableStates: config.sensorStates,
                        },
                    } : {}),
                    ...(numericType && (config.sensorNumeric || !config.sensorStates?.length) ? {
                        numericCapabilities: {
                            rawValueUnit: numericType,
                        },
                    } : {}),
                }];
                deviceConfig.state.currentSensorStateData = [{
                    name: config.sensorType,
                    currentSensorState: 'unknown',
                }];
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
                if (isSensorState(state)) {
                    const sensorState = state.currentSensorStateData[0];
                    if ('currentSensorState' in sensorState &&
                        sensorState.currentSensorState &&
                        sensorState.currentSensorState !== 'unknown') {
                        statuses.push(sensorState.currentSensorState);
                    }

                    if ('rawValue' in sensorState && typeof sensorState.rawValue === 'number') {
                        statuses.push(`S:${sensorState.rawValue}`);
                    }
                }
                update(statuses.join(' '));
            },
            handleNodeInput: async ({ msg, updateState }) => {
                if (typeof msg.payload !== 'object') {
                    return;
                }

                const update = { ...msg.payload };
                if (isSensorDevice(deviceConfig)) {
                    const stateConfig = deviceConfig.attributes.sensorStatesSupported[0];
                    const sensorState: Record<string, any> = {
                        name: config.sensorType,
                    };
                    if ('state' in update &&
                        'descriptiveCapabilities' in stateConfig &&
                        stateConfig.descriptiveCapabilities?.availableStates.includes(update.state as never)) {
                        sensorState.currentSensorState = update.state;
                        delete update.state;
                        update.currentSensorStateData = [sensorState];
                    }
                    if ('value' in update) {
                        sensorState.rawValue = update.value;
                        delete update.value;
                        update.currentSensorStateData = [sensorState];
                    }
                }

                await updateState(update, [{
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

        function isSensorState(state: any): state is SensorStateDevice['state'] {
            return isSensorDevice(deviceConfig) && 'currentSensorStateData' in state;
        }
    });
};
