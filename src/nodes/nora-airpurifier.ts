import { FanSpeedDevice, OnOffDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { FAN_STATE_MAPPING } from './mapping';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-airpurifier', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const speeds: { n: string; v: string }[] = config.speeds;

        registerNoraDevice<FanSpeedDevice & OnOffDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.AIRPURIFIER',
                traits: ['action.devices.traits.OnOff', 'action.devices.traits.FanSpeed'] as never,
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                noraSpecific: {
                },
                state: {
                    on: false,
                    online: true,
                    ...(config.percentcontrol
                        ? { currentFanSpeedPercent: 100 }
                        : { currentFanSpeedSetting: speeds[0].v }),
                },
                attributes: {
                    ...(config.percentcontrol
                        ? {
                            supportsFanSpeedPercent: true,
                        }
                        : {
                            supportsFanSpeedPercent: false,
                            availableFanSpeeds: {
                                speeds: speeds.map(s => ({
                                    /* eslint-disable */
                                    speed_name: s.v.trim(),
                                    speed_values: [{
                                        speed_synonym: s.n.split(',').map(v => v.trim()),
                                        lang: config.language,
                                    }],
                                    /* eslint-enable */
                                })),
                                ordered: true,
                            },
                        })
                },
            },
            updateStatus: ({ state, update }) => {
                const speed = 'currentFanSpeedPercent' in state
                    ? `${state.currentFanSpeedPercent}%`
                    : state.currentFanSpeedSetting;
                update(`${state.on ? 'on' : 'off'} - ${speed}`);
            },
            stateChanged: (state) => {
                this.send({
                    payload: {
                        on: state.on,
                        speed: 'currentFanSpeedPercent' in state
                            ? state.currentFanSpeedPercent
                            : state.currentFanSpeedSetting,
                    },
                    topic: config.topic
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
                    ...FAN_STATE_MAPPING(config.percentcontrol),
                ]);
            },
        });
    });
};

