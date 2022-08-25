import {
    Device, isOnOff, isTemperatureSetting, isStartStopDevice, isTimerDevice,
    OnOffDevice, TemperatureSettingDevice, StartStopDevice, TimerDevice
} from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-sousvide', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const deviceConfig: Omit<Device, 'id'> = {
            type: 'action.devices.types.SOUSVIDE',
            name: { name: config.devicename },
            traits: [] as never,
            roomHint: config.roomhint,
            state: {
                online: true,
            },
            attributes: {},
            willReportState: true,
            noraSpecific: {}
        };

        if (config.onOffSupported) {
            deviceConfig.traits.push('action.devices.traits.OnOff');
            if (isOnOff(deviceConfig)) {
                const onOffAttributes: OnOffDevice['attributes'] = {
                    commandOnlyOnOff: (config.onOffMode === 'c'),
                    queryOnlyOnOff: (config.onOffMode === 'q')
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...onOffAttributes,
                };
                const onOffState: Partial<OnOffDevice['state']> = {
                    on: false,
                };
                deviceConfig.state = {
                    ...deviceConfig.state,
                    ...onOffState,
                };
            };
        }

        if (config.temperatureSupported) {
            deviceConfig.traits.push('action.devices.traits.TemperatureSetting');
            if (isTemperatureSetting(deviceConfig)) {
                const temperatureSettingAttributes: TemperatureSettingDevice['attributes'] = {
                    availableThermostatModes: ['heat'],
                    commandOnlyTemperatureSetting: (config.temperatureMode === 'c'),
                    queryOnlyTemperatureSetting: (config.temperatureMode === 'q'),
                    thermostatTemperatureRange: {
                        minThresholdCelsius: parseInt(config.temperatureRangeMin, 10) || 0,
                        maxThresholdCelsius: parseInt(config.temperatureRangeMax, 10) || 100,
                    },
                    thermostatTemperatureUnit: config.temperatureUnit || 'C',
                    // temperatureStepCelsius: parseFloat(config.temperatureStepSize) || 1,
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...temperatureSettingAttributes,
                };
                const temperatureState: Partial<TemperatureSettingDevice['state']> = {
                    thermostatMode: 'heat',
                    thermostatTemperatureAmbient: 0,
                    thermostatTemperatureSetpoint: 0,
                };
                deviceConfig.state = {
                    ...deviceConfig.state,
                    ...temperatureState,
                };
            }
        }

        if (config.startStopSupported) {
            deviceConfig.traits.push('action.devices.traits.StartStop');
            if (isStartStopDevice(deviceConfig)) {
                const startStopAttributes: StartStopDevice['attributes'] = {
                    pausable: config.startStopPausable
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...startStopAttributes,
                };
                const startStopState: Partial<StartStopDevice['state']> = {
                    isRunning: false
                };
                deviceConfig.state = {
                    ...deviceConfig.state,
                    ...startStopState,
                };
            }
        }

        if (config.timerSupported) {
            deviceConfig.traits.push('action.devices.traits.Timer');
            if (isTimerDevice(deviceConfig)) {
                const timerAttributes: TimerDevice['attributes'] = {
                    maxTimerLimitSec: parseInt(config.timerMaxLimitSeconds, 10) || 0,
                    commandOnlyTimer: (config.timerMode === 'c' ? true : false)
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...timerAttributes,
                };
                const timerState: Partial<TimerDevice['state']> = {
                    timerRemainingSec: -1,
                    timerPaused: false
                };
                deviceConfig.state = {
                    ...deviceConfig.state,
                    ...timerState,
                };
            }
        }

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [];
                if (isOnOffState(state)) {
                    statuses.push(state.on ? 'on' : 'off');
                }
                if (isStartStopState(state)) {
                    if (state.isRunning) {
                        statuses.push(state.isPaused ? 'paused' : 'running');

                    }
                } else {
                    statuses.push('not running');
                };
                if (isTemperatureSettingState(state)) {
                    const ambientTemperature: string = state.thermostatTemperatureAmbient.toFixed(2);
                    const setpointTemperature: string = state.thermostatTemperatureSetpoint.toFixed(2);
                    statuses.push(`T:${ambientTemperature} S:${setpointTemperature}`);
                };
                if (isTimerState(state)) {
                    const remaining: string = (state.timerRemainingSec === -1 ? '' : state.timerRemainingSec.toString());
                    const paused: string = (state.timerPaused ? 'paused' : '');
                    statuses.push(`${remaining}s ${paused} `);
                }
                update(statuses.join(' '));
            },
            mapStateToOutput: state => ({
                payload: state,
            }),
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, []);
            }
        });

        function isOnOffState(state: any): state is OnOffDevice['state'] {
            return isOnOff(deviceConfig) && 'on' in state;
        }
        function isStartStopState(state: any): state is StartStopDevice['state'] {
            return isStartStopDevice(deviceConfig) && 'isRunning' in state;
        }
        function isTemperatureSettingState(state: any): state is TemperatureSettingDevice['state'] {
            return isTemperatureSetting(deviceConfig) && 'thermostatTemperatureAmbient' in state;
        }
        function isTimerState(state: any): state is TimerDevice['state'] {
            return isTimerDevice(deviceConfig) && 'timerRemainingSec' in state;
        }
    });
};
