import {
    Device, HumiditySettingDevice, isHumiditySetting, isOnOff, isOpenClose, isSensorState as isSensorDevice,
    isTemperatureControl, OnOffDevice, OpenCloseDevice, SensorStateDevice, TemperatureControlDevice
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
                const numericSupport = numericType && (config.sensorNumeric || !config.sensorStates?.length);
                deviceConfig.attributes.sensorStatesSupported = [{
                    name: config.sensorType,
                    ...(config.sensorStates?.length ? {
                        descriptiveCapabilities: {
                            availableStates: config.sensorStates,
                        },
                    } : {}),
                    ...(numericSupport ? {
                        numericCapabilities: {
                            rawValueUnit: numericType,
                        },
                    } : {}),
                }];
                deviceConfig.state.currentSensorStateData = [{
                    name: config.sensorType,
                    ...(config.sensorStates?.length ? {
                        currentSensorState: 'unknown',
                    } : {}),
                    ...(numericSupport ? {
                        rawValue: 0,
                    } : {}),
                }];
            }
        }

        if (config.openCloseSupport) {
            deviceConfig.traits.push('action.devices.traits.OpenClose');
            if (isOpenClose(deviceConfig)) {
                deviceConfig.attributes.queryOnlyOpenClose = true;
                deviceConfig.attributes.discreteOnlyOpenClose = !!config.openCloseDiscrete;

                const openCloseState: Omit<OpenCloseDevice['state'], 'online'> = {
                    openPercent: 0,
                };
                deviceConfig.state = {
                    ...deviceConfig.state,
                    ...openCloseState,
                };
            }
        }

        if (config.onOffSupport) {
            deviceConfig.traits.push('action.devices.traits.OnOff');
            if (isOnOff(deviceConfig)) {
                deviceConfig.attributes.queryOnlyOnOff = true;
                deviceConfig.state.on = false;
            }
        }

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [];
                if (isOnOffState(state)) {
                    statuses.push(state.on ? 'on' : 'off');
                }
                if (isOpenCloseState(state) && 'openPercent' in state) {
                    statuses.push(config.openCloseDiscrete
                        ? (state.openPercent ? 'opened' : 'closed')
                        : `open:${state.openPercent}%`);
                }
                if (isTemperatureState(state)) {
                    statuses.push(`T:${state.temperatureAmbientCelsius}C`);
                }
                if (isHumidityState(state)) {
                    statuses.push(`H:${state.humidityAmbientPercent}%`);
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

                if (config.openCloseSupport) {
                    if (typeof update.open === 'boolean') {
                        update.open = update.open ? 100 : 0;
                    }
                    if (config.openCloseDiscrete) {
                        update.open = +update.open ? 100 : 0;
                    }
                }

                await updateState(update, [{
                    from: 'open',
                    to: 'openPercent',
                }, {
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

        function isOpenCloseState(state: any): state is OpenCloseDevice['state'] {
            return isOpenClose(deviceConfig) && 'openPercent' in state;
        }

        function isOnOffState(state: any): state is OnOffDevice['state'] {
            return isOnOff(deviceConfig) && 'on' in state;
        }
    });
};
