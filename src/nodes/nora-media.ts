import {
    ChannelDevice, Device, InputSelectorDevice, isAppSelectorDevice, isChannelDevice, isDeviceType, isInputSelectorDevice,
    isMediaStateDevice, isOnOff, isTransportControlDevice, isVolumeDevice,
    AppSelectorDevice, MediaStateDevice, OnOffDevice, TransportControlDevice, VolumeDevice
} from '@andrei-tatar/nora-firebase-common';
import { EMPTY, switchMap, tap } from 'rxjs';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseMediaDevice } from '../nora/media-device';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-media', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

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

        const asyncCommandExecution: string[] = [];
        if (config.supportOnOff) {
            deviceConfig.traits.push('action.devices.traits.OnOff');
            if (isOnOff(deviceConfig)) {
                deviceConfig.state.on = false;
                deviceConfig.noraSpecific.returnOnOffErrorCodeIfStateAlreadySet = !!config.errorifstateunchaged;
            }

            if (config.asyncCmdOnOff) {
                asyncCommandExecution.push('action.devices.commands.OnOff');
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

            if (config.asyncCmdVolume) {
                asyncCommandExecution.push(
                    'action.devices.commands.setVolume',
                    'action.devices.commands.mute',
                    'action.devices.commands.volumeRelative');
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

            if (config.asyncCmdTransportControl) {
                asyncCommandExecution.push(
                    'action.devices.commands.mediaStop',
                    'action.devices.commands.mediaNext',
                    'action.devices.commands.mediaPrevious',
                    'action.devices.commands.mediaPause',
                    'action.devices.commands.mediaResume',
                    'action.devices.commands.mediaSeekRelative',
                    'action.devices.commands.mediaSeekToPosition',
                    'action.devices.commands.mediaRepeatMode',
                    'action.devices.commands.mediaShuffle',
                    'action.devices.commands.mediaClosedCaptioningOn',
                    'action.devices.commands.mediaClosedCaptioningOff');
            }
        }

        const mediaInputs: { v: string; n: string; d: boolean }[] = config.mediaInputs;
        if (config.supportInputSelector && mediaInputs?.length >= 1) {
            deviceConfig.traits.push('action.devices.traits.InputSelector');
            if (isInputSelectorDevice(deviceConfig)) {
                const inputSelectorAttributes: InputSelectorDevice['attributes'] = {
                    availableInputs: mediaInputs.map(i => ({
                        key: i.v,
                        names: [{
                            lang: config.language,
                            // eslint-disable-next-line @typescript-eslint/naming-convention
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

            if (config.asyncCmdInputSelector) {
                asyncCommandExecution.push(
                    'action.devices.commands.SetInput',
                    'action.devices.commands.NextInput',
                    'action.devices.commands.PreviousInput');
            }
        }

        const mediaApps: { v: string; n: string; d: boolean }[] = config.mediaApps;
        if (config.supportAppSelector && mediaApps?.length >= 1) {
            deviceConfig.traits.push('action.devices.traits.AppSelector');
            if (isAppSelectorDevice(deviceConfig)) {
                const appSelectorAttributes: AppSelectorDevice['attributes'] = {
                    availableApplications: mediaApps.map(i => ({
                        key: i.v,
                        names: [{
                            lang: config.appsLanguage,
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            name_synonym: i.n.split(',').map(s => s.trim()),
                        }],
                    }))
                };
                Object.assign(deviceConfig.attributes, appSelectorAttributes);

                const appSelectorState: Omit<AppSelectorDevice['state'], 'online'> = {
                    currentApplication: mediaApps.find(i => i.d)?.v ?? 'unknown',
                };
                Object.assign(deviceConfig.state, appSelectorState);
            }

            if (config.asyncCmdAppSelector) {
                asyncCommandExecution.push(
                    'action.devices.commands.appSelect',
                    'action.devices.commands.appSearch',
                    'action.devices.commands.appInstall');
            }
        }

        const channels: { k: string; n: string; i: string }[] = config.mediaChannels;
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

            if (config.asyncCmdChannel) {
                asyncCommandExecution.push(
                    'action.devices.commands.selectChannel',
                    'action.devices.commands.relativeChannel',
                    'action.devices.commands.returnChannel');
            }
        }

        registerNoraDevice<Device>(this, RED, config, {
            deviceConfig: {
                ...deviceConfig,
                noraSpecific: {
                    ...deviceConfig.noraSpecific,
                    asyncCommandExecution,
                },
            },
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
                if (isAppSelectorState(state)) {
                    states.push(state.currentApplication);
                }
                update(states.join(','));
            },
            mapStateToOutput: state => ({
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
                    } : null),
                    ...(isAppSelectorState(state) ? {
                        application: state.currentApplication,
                    } : null)
                },
            }),
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
                }, {
                    from: 'application',
                    to: 'currentApplication',
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

        function isAppSelectorState(state: Device['state']): state is AppSelectorDevice['state'] {
            return isAppSelectorDevice(deviceConfig) && 'currentApplication' in state;
        }
    });
};
