import { Device, isOnOff, isTemperatureControl, OnOffDevice, TemperatureControlDevice } from '@andrei-tatar/nora-firebase-common';
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
            type: 'action.devices.types.SOUS_VIDE',
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

        deviceConfig.traits.push('action.devices.traits.OnOff');
        if (isOnOff(deviceConfig)) {
            const onOffAttributes: OnOffDevice['attributes'] = {
                commandOnlyOnOff: config.commandOnly,
                queryOnlyOnOff: config.queryOnly,
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

        if (config.temperature) {
            deviceConfig.traits.push('action.devices.traits.TemperatureControl');
            if (isTemperatureControl(deviceConfig)) {
                const temperatureControlAttributes: TemperatureControlDevice['attributes'] = {
                    temperatureUnitForUX: config.unit || 'C',
                    temperatureRange: {
                        minThresholdCelsius: parseInt(config.rangeMin, 10) || 0,
                        maxThresholdCelsius: parseInt(config.rangeMax, 10) || 100,
                    }
                };
                deviceConfig.attributes = {
                    ...deviceConfig.attributes,
                    ...temperatureControlAttributes,
                };
            }
        }

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [];
                if (isTemperatureControlState(state)) {
                    statuses.push(`T:${state.temperatureAmbientCelsius}S:${state.temperatureSetpointCelsius}`);
                }
                update(statuses.join(' '));
            },
            stateChanged: state => {
                if (isTemperatureControlState(state)) {
                    this.send({
                        payload: {
                            setpoint: state.temperatureSetpointCelsius,
                            ambient: state.temperatureAmbientCelsius,
                        },
                        topic: config.topic
                    });
                };

            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, []);
            }
        });

        function isTemperatureControlState(state: any): state is TemperatureControlDevice['state'] {
            return isTemperatureControl(deviceConfig) && 'temperatureAmbientCelsius' in state;
        }

    });
};
