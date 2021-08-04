import {
    Device, InputSelectorDevice, isInputSelectorDevice, isMediaStateDevice, isOnOff, isTransportControlDevice, isVolumeDevice,
    MediaStateDevice, OnOffDevice, TransportControlDevice, VolumeDevice
} from '@andrei-tatar/nora-firebase-common';
import { EMPTY, switchMap, tap } from 'rxjs';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseTransportControlDevice } from '../nora/transport-control-device';
import { registerNoraDevice } from './util';

type ConfigDeviceType = 'SPEAKER' | 'AUDIO_VIDEO_RECEIVER' | 'REMOTECONTROL' |
    'SETTOP' | 'SOUNDBAR' | 'STREAMING_BOX' | 'STREAMING_SOUNDBAR' | 'STREAMING_STICK' | 'TV';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-media', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const deviceType: ConfigDeviceType = config.deviceType;
        const deviceConfig: Omit<Device, 'id'> = {
            type: `action.devices.types.${deviceType}`,
            traits: [],
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            attributes: {
            },
            state: {
                online: true,
            },
            noraSpecific: {
            },
        };

        if (config.supportOnOff) {
            deviceConfig.traits.push('action.devices.traits.OnOff');
            if (isOnOff(deviceConfig)) {
                deviceConfig.state.on = false;
            }
        }

        if (config.supportVolume) {
            deviceConfig.traits.push('action.devices.traits.Volume');
            if (isVolumeDevice(deviceConfig)) {
                const volumeState: Omit<VolumeDevice['state'], 'online'> = {
                    currentVolume: 40,
                    isMuted: false,
                };
                Object.assign(deviceConfig.state, volumeState);

                const volumeAttributes: VolumeDevice['attributes'] = {
                    volumeCanMuteAndUnmute: !!config.volumeCanMuteAndUnmute,
                    volumeMaxLevel: 100,
                    levelStepSize: parseInt(config.volumeLevelStepSize, 10) || undefined,
                };
                Object.assign(deviceConfig.attributes, volumeAttributes);
            }
        }

        if (config.supportMediaState) {
            deviceConfig.traits.push('action.devices.traits.MediaState');
            if (isMediaStateDevice(deviceConfig)) {
                const mediaState: Omit<MediaStateDevice['state'], 'online'> = {
                };
                Object.assign(deviceConfig.state, mediaState);

                const mediaStateAttributes: MediaStateDevice['attributes'] = {
                    supportActivityState: config.supportActivityState,
                    supportPlaybackState: config.supportPlaybackState,
                };
                Object.assign(deviceConfig.attributes, mediaStateAttributes);
            }
        }

        if (config.supportTransportControl && config.transportControlCommands?.length > 0) {
            deviceConfig.traits.push('action.devices.traits.TransportControl');
            if (isTransportControlDevice(deviceConfig)) {
                const transportControlAttributes: TransportControlDevice['attributes'] = {
                    transportControlSupportedCommands: config.transportControlCommands,
                };
                Object.assign(deviceConfig.attributes, transportControlAttributes);
            }
        }

        if (config.supportInputSelector) {
            deviceConfig.traits.push('action.devices.traits.InputSelector');
            if (isInputSelectorDevice(deviceConfig)) {
                const inputSelectorAttributes: InputSelectorDevice['attributes'] = {
                    availableInputs: [],
                    orderedInputs: true,
                };
                Object.assign(deviceConfig.attributes, inputSelectorAttributes);

                const inputSelectorState: Omit<InputSelectorDevice['state'], 'online'> = {
                    currentInput: 'bla',
                };
                Object.assign(deviceConfig.state, inputSelectorState);
            }
        }

        registerNoraDevice<Device>(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const states: string[] = [];
                if (isOnOffState(state)) {
                    states.push(state.on ? 'on' : 'off');
                }
                if (isVolumeState(state)) {
                    states.push(state.isMuted ? 'mute' : `${state.currentVolume}`);
                }
                if (isMediaStateDeviceState(state)) {
                    if (state.activityState) {
                        states.push(state.activityState.toLowerCase());
                    }
                    if (state.playbackState) {
                        states.push(state.playbackState.toLowerCase());
                    }
                }
                if (isInputSelectorState(state)) {
                    states.push(state.currentInput);
                }
                update(states.join(','));
            },
            stateChanged: state => {
                this.send({
                    payload: {
                        ...(isOnOffState(state) ? { on: state.on } : null),
                        ...(isVolumeState(state) ? {
                            volume: state.currentVolume,
                            mute: state.isMuted,
                        } : null),
                        ...(isMediaStateDeviceState(state) ? {
                            activity: state.activityState,
                            playback: state.playbackState,
                        } : null),
                        ...(isInputSelectorState(state) ? {
                            input: state.currentInput,
                        } : null)
                    },
                    topic: config.topic,
                });
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, [{
                    from: 'volume',
                    to: 'currentVolume',
                }, {
                    from: 'mute',
                    to: 'isMuted',
                }, {
                    from: 'activity',
                    to: 'activityState',
                }, {
                    from: 'playback',
                    to: 'playbackState',
                }, {
                    from: 'input',
                    to: 'currentInput',
                }]);
            },
            customRegistration: device$ => device$.pipe(
                switchMap(d => d instanceof FirebaseTransportControlDevice
                    ? d.command$
                    : EMPTY),
                tap(command => {
                    this.send({
                        payload: command,
                        topic: config.topic,
                    });
                }),
            ),
        });

        function isOnOffState(state: Device['state']): state is OnOffDevice['state'] {
            return isOnOff(deviceConfig) && 'on' in state;
        }

        function isMediaStateDeviceState(state: Device['state']): state is MediaStateDevice['state'] {
            return isMediaStateDevice(deviceConfig) && ('activityState' in state || 'playbackState' in state);
        }

        function isVolumeState(state: Device['state']): state is VolumeDevice['state'] {
            return isVolumeDevice(deviceConfig) && 'currentVolume' in state;
        }

        function isInputSelectorState(state: Device['state']): state is InputSelectorDevice['state'] {
            return isInputSelectorDevice(deviceConfig) && 'currentInput' in state;
        }
    });
};
