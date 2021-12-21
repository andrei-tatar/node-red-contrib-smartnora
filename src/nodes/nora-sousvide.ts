import { TemperatureControlDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-sousvide', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const deviceConfig: Omit<TemperatureControlDevice, 'id'> = {
            type: 'action.devices.types.SOUS_VIDE',
            name: { name: config.devicename },
            traits: ['action.devices.traits.TemperatureControl'],
            state: {
                online: true,
                temperatureSetpointCelsius: 50,
                temperatureAmbientCelsius: 25,
            },
            attributes: {
                queryOnlyTemperatureControl: config.queryOnlyTemperatureControl,
                temperatureUnitForUX: config.temperatureUnitForUX,
                temperatureRange: {
                    minThresholdCelsius: parseInt(config.rangeMin, 10) || 0,
                    maxThresholdCelsius: parseInt(config.rangeMax, 10) || 100,
                }
            },
            willReportState: true,
            noraSpecific: {}
        };

        registerNoraDevice<TemperatureControlDevice>(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                update(
                    `T:${state.temperatureAmbientCelsius}S:${state.temperatureSetpointCelsius}`
                );
            },
            stateChanged: state => {
                this.send({
                    payload: {
                        setpoint: state.temperatureSetpointCelsius,
                        ambient: state.temperatureAmbientCelsius,
                    },
                    topic: config.topic,
                });
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, []);
            },
        });
    });
};
