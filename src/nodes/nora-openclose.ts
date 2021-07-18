import { Device, isLockUnlock, LockUnlockDevice, OpenCloseDevice, OpenCloseDirection } from '@andrei-tatar/nora-firebase-common';
import { Schema } from '@andrei-tatar/nora-firebase-common/build/schema';
import { firstValueFrom } from 'rxjs';
import { ConfigNode, NodeInterface } from '..';
import { convertValueType, getValue, registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-openclose', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const deviceType = `action.devices.types.${config.openclosetype}`;
        if (!Schema.device.openclose.properties.type.enum.includes(deviceType)) {
            this.warn(`Device type not supported: ${deviceType}`);
            return;
        }

        const directions: string | undefined = config.directions;
        let openCloseDirections: OpenCloseDirection[] | undefined = directions?.split(',')?.filter(f => !!f) as any;
        if (!openCloseDirections?.length) {
            openCloseDirections = undefined;
        }
        if (openCloseDirections?.some(d => !Schema.device.openclose.definitions.OpenCloseDirection.enum.includes(d))) {
            this.warn(`Open/Close direction not supported: ${directions}`);
            return;
        }

        const useDiscreteValues: boolean = config.discrete ?? true;
        const useOpenCloseDefinedValues = useDiscreteValues && !openCloseDirections && !config.lockunlock;
        const {
            value: openValue,
            type: openType,
        } = convertValueType(RED, config.openvalue, config.openvalueType, { defaultValue: true });
        const {
            value: closeValue,
            type: closeType,
        } = convertValueType(RED, config.closevalue, config.closevalueType, { defaultValue: false });

        const deviceConfig: Omit<OpenCloseDevice, 'id'> = {
            type: deviceType as Device['type'],
            traits: ['action.devices.traits.OpenClose'],
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            state: {
                online: true,
                ...(openCloseDirections?.length
                    ? {
                        openState: openCloseDirections.map(direction => ({
                            openDirection: direction,
                            openPercent: 0,
                        }))
                    }
                    : {
                        openPercent: 0,
                    })
            },
            noraSpecific: {
                returnOpenCloseErrorCodeIfStateAlreadySet: !!config.errorifstateunchaged,
            },
            attributes: {
                discreteOnlyOpenClose: useDiscreteValues,
                openDirection: openCloseDirections,
                commandOnlyOpenClose: config.commandonly ?? false,
                queryOnlyOpenClose: config.queryonly ?? false,
            },
        };

        if (config.lockunlock) {
            deviceConfig.traits.push('action.devices.traits.LockUnlock');
            if (isLockUnlock(deviceConfig)) {
                deviceConfig.state.isLocked = false;
                deviceConfig.state.isJammed = false;
            }
        }

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                let stateString = 'openPercent' in state
                    ? openPercent(state.openPercent)
                    : state.openState.map(s => `${s.openDirection}:${openPercent(s.openPercent)}`).join(', ');

                if (isLockUnlockState(deviceConfig, state)) {
                    if (state.isJammed) {
                        stateString += ' jammed';
                    } else {
                        stateString += ` ${state.isLocked ? 'locked' : 'unlocked'}`;
                    }
                }

                update(stateString);
            },
            stateChanged: state => {
                if (useOpenCloseDefinedValues && 'openPercent' in state) {
                    if (state.openPercent === 0) {
                        this.send({
                            payload: getValue(RED, this, closeValue, closeType),
                            topic: config.topic
                        });
                    } else {
                        this.send({
                            payload: getValue(RED, this, openValue, openType),
                            topic: config.topic
                        });
                    }
                } else {
                    const payload: any = { online: state.online };

                    if (isLockUnlockState(deviceConfig, state)) {
                        payload.locked = state.isLocked;
                        payload.jammed = state.isJammed;
                    }

                    if ('openPercent' in state) {
                        payload.open = state.openPercent;
                        this.send({
                            payload,
                            topic: config.topic,
                        });
                    } else {
                        for (const directionState of state.openState) {
                            this.send({
                                payload: {
                                    ...payload,
                                    open: directionState.openPercent,
                                    direction: directionState.openDirection,
                                },
                                topic: config.topic,
                            });
                        }
                    }
                }
            },
            handleNodeInput: async ({ msg, updateState, state$ }) => {
                if (!useOpenCloseDefinedValues) {
                    const state = await firstValueFrom(state$);
                    const payload = { ...msg.payload };
                    if (openCloseDirections?.length && 'openState' in state) {
                        if (typeof payload === 'object' && 'open' in payload) {
                            const payloadDirection = msg?.payload?.direction;
                            const direction = typeof payloadDirection === 'string'
                                ? payloadDirection.trim().toUpperCase()
                                : null;

                            payload.openState = state.openState.map(st => ({
                                openDirection: st.openDirection,
                                openPercent: st.openDirection === direction || direction == null
                                    ? msg.payload.open
                                    : st.openPercent,
                            }));

                            delete payload.open;
                            delete payload.direction;
                        }
                    }
                    await updateState(payload, [{
                        from: 'open',
                        to: 'openPercent',
                    }, {
                        from: 'locked',
                        to: 'isLocked',
                    }, {
                        from: 'jammed',
                        to: 'isJammed',
                    }]);
                } else {
                    const myOpenValue = getValue(RED, this, openValue, openType);
                    const myCloseValue = getValue(RED, this, closeValue, closeType);
                    if (RED.util.compareObjects(myOpenValue, msg.payload)) {
                        await updateState({ openPercent: 100 });
                    } else if (RED.util.compareObjects(myCloseValue, msg.payload)) {
                        await updateState({ openPercent: 0 });
                    } else {
                        await updateState(msg.payload);
                    }
                }
            },
        });

        function openPercent(percent: number) {
            switch (percent) {
                case 0: return 'closed';
                case 100: return 'open';
                default: return `${percent}%`;
            }
        }

        function isLockUnlockState(device: Pick<Device, 'traits'>, state: Device['state']): state is LockUnlockDevice['state'] {
            return isLockUnlock(device);
        }
    });
};
