import {
    Device, isStartStopDevice, isTimerDevice, StartStopDevice, TimerDevice
} from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-sprinkler', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const deviceConfig: Omit<Device, 'id'> = {
            type: 'action.devices.types.SPRINKLER',
            name: { name: config.devicename },
            traits: [] as never,
            roomHint: config.roomhint,
            state: {
                online: true,
            },
            attributes: {},
            willReportState: true,
            noraSpecific: {
                asyncCommandExecution: !!config.asyncCmd,
            },
        };

        if (config.startStopSupported) {
            deviceConfig.traits.push('action.devices.traits.StartStop');
            if (isStartStopDevice(deviceConfig)) {
                const startStopAttributes: StartStopDevice['attributes'] = {
                    pausable: config.startStopPausable,
                    availableZones: config.startStopZones
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...startStopAttributes,
                };
                const startStopState: Omit<StartStopDevice['state'], 'online'> = {
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
                const timerState: Omit<TimerDevice['state'], 'online'> = {
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

                if (isStartStopState(state)) {
                    statuses.push(state.isRunning
                        ? (state.isPaused ? 'paused' : 'running')
                        : 'not running');
                }

                if (isTimerState(state)) {
                    if (state.timerRemainingSec !== -1) {
                        statuses.push(`${state.timerRemainingSec}s`);
                    }

                    if (state.timerPaused) {
                        statuses.push('paused');
                    }
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

        function isStartStopState(state: any): state is StartStopDevice['state'] {
            return isStartStopDevice(deviceConfig) && 'isRunning' in state;
        }

        function isTimerState(state: any): state is TimerDevice['state'] {
            return isTimerDevice(deviceConfig) && 'timerRemainingSec' in state;
        }
    });
};
