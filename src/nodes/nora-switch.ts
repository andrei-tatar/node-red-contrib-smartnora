import { OnOffDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { convertValueType, getValue, registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-switch', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const { value: onValue, type: onType } = convertValueType(RED, config.onvalue, config.onvalueType, { defaultValue: true });
        const { value: offValue, type: offType } = convertValueType(RED, config.offvalue, config.offvalueType, { defaultValue: false });

        registerNoraDevice<OnOffDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.SWITCH',
                traits: ['action.devices.traits.OnOff'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                state: {
                    on: false,
                    online: true,
                },
                attributes: {
                },
                noraSpecific: {
                    returnOnOffErrorCodeIfStateAlreadySet: !!config.errorifstateunchaged,
                    asyncCommandExecution: !!config.asyncCmd,
                },
            },
            updateStatus: ({ state, update }) => {
                update(`${state.on ? 'on' : 'off'}`);
            },
            mapStateToOutput: state => {
                const value = state.on;
                return {
                    payload: getValue(RED, this, value ? onValue : offValue, value ? onType : offType),
                };
            },
            handleNodeInput: async ({ msg, updateState }) => {
                const myOnValue = getValue(RED, this, onValue, onType);
                const myOffValue = getValue(RED, this, offValue, offType);
                if (RED.util.compareObjects(myOnValue, msg.payload)) {
                    await updateState({ on: true });
                } else if (RED.util.compareObjects(myOffValue, msg.payload)) {
                    await updateState({ on: false });
                } else {
                    await updateState(msg.payload);
                }
            },
        });
    });
};

