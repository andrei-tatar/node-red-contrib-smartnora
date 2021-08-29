import { TemperatureSettingDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { TEMPERATURE_SETTING_STATE_MAPPING } from './mapping';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-thermostat', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const availableModes = config.modes.split(',');

        registerNoraDevice<TemperatureSettingDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.THERMOSTAT',
                traits: ['action.devices.traits.TemperatureSetting'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                attributes: {
                    availableThermostatModes: availableModes,
                    thermostatTemperatureUnit: config.unit,
                    bufferRangeCelsius: parseInt(config.bufferRangeCelsius, 10) || undefined,
                    commandOnlyTemperatureSetting: config.commandOnly ?? undefined,
                    queryOnlyTemperatureSetting: config.queryOnly ?? undefined,
                    thermostatTemperatureRange: {
                        minThresholdCelsius: parseInt(config.rangeMin, 10) || 10,
                        maxThresholdCelsius: parseInt(config.rangeMax, 10) || 32,
                    },
                },
                state: {
                    online: true,
                    thermostatMode: 'off',
                    thermostatTemperatureAmbient: 25,
                    thermostatTemperatureSetpoint: 20,
                },
                noraSpecific: {
                },
            },
            updateStatus: ({ state, update }) => {
                const setpoint = state.thermostatMode === 'heatcool' ?
                    `${state.thermostatTemperatureSetpointLow}-${state.thermostatTemperatureSetpointHigh}` :
                    `${state.thermostatTemperatureSetpoint}`;

                update(
                    `(${state.thermostatMode}/T:${state.thermostatTemperatureAmbient}/S:${setpoint})`
                );
            },
            stateChanged: state => {
                this.send({
                    payload: {
                        mode: state.thermostatMode,
                        activeMode: state.activeThermostatMode,
                        setpoint: state.thermostatTemperatureSetpoint,
                        setpointLow: state.thermostatTemperatureSetpointLow,
                        setpointHigh: state.thermostatTemperatureSetpointHigh,
                    },
                    topic: config.topic,
                });
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, [
                    ...TEMPERATURE_SETTING_STATE_MAPPING,
                ]);
            },
        });
    });
};
