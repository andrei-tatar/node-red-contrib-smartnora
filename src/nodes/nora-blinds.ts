import { OpenCloseDevice } from '@andrei-tatar/nora-firebase-common';
import { NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-blinds', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        registerNoraDevice<OpenCloseDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.BLINDS',
                traits: ['action.devices.traits.OpenClose'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                noraSpecific: {
                },
                state: {
                    online: true,
                    openPercent: 100,
                },
                attributes: {
                },
            },
            updateStatus: ({ state, update }) => {
                update(`${'openPercent' in state && adjustPercent(state.openPercent)}%`);
            },
            mapStateToOutput: (state) => {
                if ('openPercent' in state) {
                    return {
                        payload: {
                            openPercent: adjustPercent(state.openPercent),
                        },
                    };
                }
            },
            handleNodeInput: async ({ msg, updateState }) => {
                if (typeof msg?.payload?.openPercent === 'number') {
                    msg.payload.openPercent = adjustPercent(msg.payload.openPercent);
                }
                await updateState(msg?.payload);
            },
        });

        function adjustPercent(openPercent: number) {
            return config.invert ? 100 - openPercent : openPercent;
        }
    });
};

