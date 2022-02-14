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
            noraSpecific: {}
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
                if (isStartStopState(state)) {
                    if (state.isRunning) {
                        statuses.push(state.isPaused ? 'paused' : 'running');

                    }
                } else {
                    statuses.push('not running');
                };
                if (isTimerState(state)) {
                    const remaining: string = (state.timerRemainingSec === -1 ? '' : state.timerRemainingSec.toString());
                    const paused: string = (state.timerPaused ? 'paused' : '');
                    statuses.push(`${remaining}s ${paused} `);
                }
                update(statuses.join(' '));
            },
            stateChanged: state => {
                this.send({
                    payload: state,
                    topic: config.topic
                });
            },
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
