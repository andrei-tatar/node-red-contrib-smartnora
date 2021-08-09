import { FanSpeedDevice, TemperatureSettingDevice, Trait } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { FAN_STATE_MAPPING, TEMPERATURE_SETTING_STATE_MAPPING } from './mapping';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-ac', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const availableModes = config.modes.split(',');
        const speeds: { n: string, v: string }[] = config.speeds;

        registerNoraDevice<TemperatureSettingDevice & FanSpeedDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.AC_UNIT',
                traits: [
                    'action.devices.traits.TemperatureSetting',
                    'action.devices.traits.FanSpeed',
                ] as Trait[] as never,
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                attributes: {
                    availableThermostatModes: availableModes,
                    thermostatTemperatureUnit: config.unit,
                    bufferRangeCelsius: parseInt(config.bufferRangeCelsius, 10) || undefined,
                    thermostatTemperatureRange: {
                        minThresholdCelsius: parseInt(config.rangeMin, 10) || 10,
                        maxThresholdCelsius: parseInt(config.rangeMax, 10) || 32,
                    },
                    ...(config.percentcontrol
                        ? {
                            supportsFanSpeedPercent: true,
                        }
                        : {
                            supportsFanSpeedPercent: false,
                            availableFanSpeeds: {
                                speeds: speeds.map(s => ({
                                    speed_name: s.v.trim(),
                                    speed_values: [{
                                        speed_synonym: s.n.split(',').map(v => v.trim()),
                                        lang: config.language,
                                    }],
                                })),
                                ordered: true,
                            },
                        }),
                },
                state: {
                    online: true,
                    thermostatMode: 'off',
                    thermostatTemperatureAmbient: 25,
                    thermostatTemperatureSetpoint: 20,
                    ...(config.percentcontrol
                        ? { currentFanSpeedPercent: 100 }
                        : { currentFanSpeedSetting: speeds[0].v }),
                },
                noraSpecific: {
                },
            },
            updateStatus: ({ state, update }) => {
                const setpoint = state.thermostatMode === 'heatcool' ?
                    `${state.thermostatTemperatureSetpointLow}-${state.thermostatTemperatureSetpointHigh}` :
                    `${state.thermostatTemperatureSetpoint}`;

                const speed = 'currentFanSpeedPercent' in state
                    ? `${state.currentFanSpeedPercent}%`
                    : state.currentFanSpeedSetting;

                const statuses: string[] = [
                    `${state.thermostatMode}`,
                    `T:${state.thermostatTemperatureAmbient}`,
                    `S:${setpoint}`,
                    `F:${speed}`,
                ];

                update(`(${statuses.join('/')})`);
            },
            stateChanged: state => {
                this.send({
                    payload: {
                        mode: state.thermostatMode,
                        activeMode: state.activeThermostatMode,
                        setpoint: state.thermostatTemperatureSetpoint,
                        setpointLow: state.thermostatTemperatureSetpointLow,
                        setpointHigh: state.thermostatTemperatureSetpointHigh,
                        speed: 'currentFanSpeedPercent' in state
                            ? state.currentFanSpeedPercent
                            : state.currentFanSpeedSetting,
                    },
                    topic: config.topic,
                });
            },
            handleNodeInput: async ({ msg, updateState }) => {
                if (!config.percentcontrol &&
                    (msg?.payload?.speed ?? undefined) !== undefined &&
                    !speeds.find(s => s.v === msg.payload.speed)) {
                    this.warn(`invalid fan speed: ${msg.payload.speed}`);
                    return;
                }

                await updateState(msg?.payload, [
                    ...TEMPERATURE_SETTING_STATE_MAPPING,
                    ...FAN_STATE_MAPPING(config.percentcontrol),
                ]);
            },
        });
    });
};
