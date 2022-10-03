import {
    DockDevice,
    isDockDevice,
    isOnOff, OnOffDevice, StartStopDevice
} from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-vacuum', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const deviceConfig: Omit<StartStopDevice, 'id'> = {
            type: 'action.devices.types.VACUUM',
            name: { name: config.devicename },
            traits: ['action.devices.traits.StartStop'] as never,
            roomHint: config.roomhint,
            state: {
                online: true,
                isRunning: false
            },
            attributes: {
                pausable: config.startStopPausable
            },
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

        if (config.dockSupported) {
            deviceConfig.traits.push('action.devices.traits.Dock');
            if (isDockDevice(deviceConfig)) {
                const dockState: Partial<DockDevice['state']> = {
                    isDocked: true,
                };
                deviceConfig.state = {
                    ...deviceConfig.state,
                    ...dockState,
                };

                const dockNoraSpecific: DockDevice['noraSpecific'] = {
                    returnDockErrorCodeIfAlreadyDocked: true,
                };

                deviceConfig.noraSpecific = {
                    ...deviceConfig.noraSpecific,
                    ...dockNoraSpecific,
                };
            };
        }

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [];

                if (isOnOffState(state)) {
                    statuses.push(state.on ? 'on' : 'off');
                }

                statuses.push(state.isRunning
                    ? (state.isPaused ? 'paused' : 'running')
                    : 'not running');

                if (isDockState(state) && state.isDocked) {
                    statuses.push('docked');
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

        function isDockState(state: any): state is DockDevice['state'] {
            return isDockDevice(deviceConfig) && 'isDocked' in state;
        }
    });
};
