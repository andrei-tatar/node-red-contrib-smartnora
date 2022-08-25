import { OpenCloseDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { convertValueType, getValue, registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-garage', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const { value: openValue, type: openType } =
            convertValueType(RED, config.openvalue, config.openvalueType, { defaultValue: true });
        const { value: closeValue, type: closeType } =
            convertValueType(RED, config.closevalue, config.closevalueType, { defaultValue: false });

        registerNoraDevice<OpenCloseDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.GARAGE',
                traits: ['action.devices.traits.OpenClose'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                state: {
                    online: true,
                    openPercent: 0,
                },
                noraSpecific: {
                    returnOpenCloseErrorCodeIfStateAlreadySet: !!config.errorifstateunchaged,
                },
                attributes: {
                    discreteOnlyOpenClose: true,
                },
            },
            updateStatus: ({ state, update }) => {
                if ('openPercent' in state) {
                    if (state.openPercent === 0) {
                        update('(closed)');
                    } else {
                        update('(open)');
                    }
                }
            },
            mapStateToOutput: state => {
                if ('openPercent' in state) {
                    if (state.openPercent === 0) {
                        return {
                            payload: getValue(RED, this, closeValue, closeType),
                        };
                    } else {
                        return {
                            payload: getValue(RED, this, openValue, openType),
                        };
                    }
                }
            },
            handleNodeInput: async ({ msg, updateState }) => {
                const myOpenValue = getValue(RED, this, openValue, openType);
                const myCloseValue = getValue(RED, this, closeValue, closeType);
                if (RED.util.compareObjects(myOpenValue, msg.payload)) {
                    await updateState({ openPercent: 100 });
                } else if (RED.util.compareObjects(myCloseValue, msg.payload)) {
                    await updateState({ openPercent: 0 });
                } else {
                    await updateState(msg.payload);
                }
            },
        });
    });
};
