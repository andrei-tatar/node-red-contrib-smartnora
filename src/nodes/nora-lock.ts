import { LockUnlockDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { convertValueType, getValue, registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-lock', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const { value: lockValue, type: lockType } = convertValueType(RED, config.lockValue,
            config.lockValueType, { defaultValue: true });
        const { value: unlockValue, type: unlockType } = convertValueType(RED, config.unlockValue,
            config.unlockValueType, { defaultValue: false });

        const { value: jammedValue, type: jammedType } = convertValueType(RED, config.jammedValue,
            config.jammedValueType, { defaultValue: true });
        const { value: unjammedValue, type: unjammedType } = convertValueType(RED, config.unjammedValue,
            config.unjammedValueType, { defaultValue: false });

        registerNoraDevice<LockUnlockDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.LOCK',
                traits: ['action.devices.traits.LockUnlock'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                attributes: {
                },
                state: {
                    online: true,
                    isLocked: false,
                    isJammed: false,
                },
                noraSpecific: {
                    returnLockUnlockErrorCodeIfStateAlreadySet: !!config.errorifstateunchaged,
                },
            },
            updateStatus: ({ state, update }) => {
                if (state.isJammed) {
                    update(`(jammed)`);
                } else {
                    update(`(${state.isLocked ? 'locked' : 'unlocked'})`);
                }
            },
            stateChanged: state => {
                const lvalue = state.isLocked;
                if (!state.isJammed) {
                    this.send({
                        payload: getValue(RED, this, lvalue ? lockValue : unlockValue, lvalue ? lockType : unlockType),
                        topic: config.topic,
                    });
                } else {
                    this.error('Lock is jammed');
                }
            },
            handleNodeInput: async ({ msg, updateState }) => {
                const myLockValue = getValue(RED, this, lockValue, lockType);
                const myUnlockValue = getValue(RED, this, unlockValue, unlockType);
                if (msg.topic?.toLowerCase() === 'jammed') {
                    const myJammedValue = getValue(RED, this, jammedValue, jammedType);
                    const myUnjammedValue = getValue(RED, this, unjammedValue, unjammedType);
                    if (RED.util.compareObjects(myJammedValue, msg.payload)) {
                        await updateState({ isJammed: true });
                    } else if (RED.util.compareObjects(myUnjammedValue, msg.payload)) {
                        await updateState({ isJammed: false });
                    } else {
                        await updateState(msg.payload);
                    }
                } else {
                    if (RED.util.compareObjects(myLockValue, msg.payload)) {
                        await updateState({ isLocked: true });
                    } else if (RED.util.compareObjects(myUnlockValue, msg.payload)) {
                        await updateState({ isLocked: false });
                    } else {
                        await updateState(msg.payload);
                    }
                }
            },
        });
    });
};

