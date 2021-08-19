import {
    ChannelDevice, Device, InputSelectorDevice, isChannelDevice, isDeviceType, isInputSelectorDevice,
    isMediaStateDevice, isOnOff, isTransportControlDevice, isVolumeDevice,
    MediaStateDevice, OnOffDevice, TransportControlDevice, VolumeDevice
} from '@andrei-tatar/nora-firebase-common';
import { EMPTY, switchMap, tap } from 'rxjs';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseMediaDevice } from '../nora/media-device';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-media', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const deviceType = `action.devices.types.${config.deviceType}`;
        if (!isDeviceType(deviceType)) {
            this.warn(`Device type not supported: ${deviceType}`);
            return;
        }

        const deviceConfig: Omit<Device, 'id'> = {
            type: deviceType,
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

        const mediaInputs: { v: string, n: string, d: boolean }[] = config.mediaInputs;
        if (config.supportInputSelector && mediaInputs?.length >= 1) {
            deviceConfig.traits.push('action.devices.traits.InputSelector');
            if (isInputSelectorDevice(deviceConfig)) {
                const inputSelectorAttributes: InputSelectorDevice['attributes'] = {
                    availableInputs: mediaInputs.map(i => ({
                        key: i.v,
                        names: [{
                            lang: config.language,
                            name_synonym: i.n.split(',').map(s => s.trim()),
                        }],
                    })),
                    orderedInputs: true,
                };
                Object.assign(deviceConfig.attributes, inputSelectorAttributes);

                const inputSelectorState: Omit<InputSelectorDevice['state'], 'online'> = {
                    currentInput: (mediaInputs.find(i => i.d) ?? mediaInputs[0]).v,
                };
                Object.assign(deviceConfig.state, inputSelectorState);
            }
        }

        const channels: { k: string, n: string; i: string }[] = config.mediaChannels;
        if (config.supportChannel && channels?.length >= 1) {
            deviceConfig.traits.push('action.devices.traits.Channel');
            if (isChannelDevice(deviceConfig)) {
                const channelAttributes: ChannelDevice['attributes'] = {
                    availableChannels: channels.map(c => ({
                        key: c.k,
                        names: c.n.split(',').map(n => n.trim()),
                        number: c.i,
                    })),
                };
                Object.assign(deviceConfig.attributes, channelAttributes);
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
                switchMap(d => d instanceof FirebaseMediaDevice
                    ? d.mediaCommand$
                    : EMPTY),
                tap(command => {
                    this.send([null, {
                        payload: command,
                        topic: config.topic,
                    }]);
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
