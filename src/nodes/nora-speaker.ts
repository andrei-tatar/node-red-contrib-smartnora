import { OnOffDevice, VolumeDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-speaker', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        registerNoraDevice<VolumeDevice & OnOffDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.SPEAKER',
                traits: ['action.devices.traits.Volume', 'action.devices.traits.OnOff'] as never,
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                state: {
                    on: false,
                    online: true,
                    currentVolume: 50,
                    isMuted: false,
                },
                noraSpecific: {
                },
                attributes: {
                    volumeCanMuteAndUnmute: false,
                    volumeMaxLevel: 100,
                    levelStepSize: parseInt(config.step, 10) || 1,
                },
            },
            updateStatus: ({ state, update }) => {
                update(`${state.on ? 'on' : 'off'}:${state.isMuted ? 'mute' : state.currentVolume}`);
            },
            stateChanged: state => {
                this.send({
                    payload: {
                        on: state.on,
                        volume: state.currentVolume,
                    },
                    topic: config.topic
                });
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload, [{
                    from: 'volume',
                    to: 'currentVolume',
                }]);
            },
        });
    });
};
