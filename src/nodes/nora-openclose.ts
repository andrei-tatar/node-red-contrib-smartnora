import { Device, isLockUnlock, LockUnlockDevice, OpenCloseDevice, OpenCloseDirection } from '@andrei-tatar/nora-firebase-common';
import { Schema } from '@andrei-tatar/nora-firebase-common/build/schema';
import { firstValueFrom, Subject } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { convertValueType, getId, getValue, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-openclose', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject<void>();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

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

        const deviceConfig = noraConfig.setCommon<OpenCloseDevice>({
            id: getId(config),
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
            },
            attributes: {
                discreteOnlyOpenClose: useDiscreteValues,
                openDirection: openCloseDirections,
                commandOnlyOpenClose: config.commandonly ?? false,
                queryOnlyOpenClose: config.queryonly ?? false,
            },
        }, config);

        if (config.lockunlock) {
            deviceConfig.traits.push('action.devices.traits.LockUnlock');
        }

        if (isLockUnlock(deviceConfig)) {
            deviceConfig.state.isLocked = false;
            deviceConfig.state.isJammed = false;
        }

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, ctx)
            .pipe(
                switchMap(connection => connection.withDevice(deviceConfig, ctx)),
                withLocalExecution(noraConfig),
                singleton(),
                takeUntil(close$),
            );

        device$.pipe(
            switchMap(d => d.state$),
            tap(state => notifyState(state)),
            takeUntil(close$),
        ).subscribe();

        device$.pipe(
            switchMap(d => d.stateUpdates$),
            takeUntil(close$),
        ).subscribe(state => {
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
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }
            try {
                const device = await firstValueFrom(device$);
                if (!useOpenCloseDefinedValues) {
                    const state = await firstValueFrom(device.state$);
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
                    await device.updateState(payload, [{
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
                        await device.updateState({ openPercent: 100 });
                    } else if (RED.util.compareObjects(myCloseValue, msg.payload)) {
                        await device.updateState({ openPercent: 0 });
                    } else {
                        await device.updateState(msg.payload);
                    }
                }
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: OpenCloseDevice['state']) {
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
            ctx.state$.next(`(${stateString})`);
        }

        function openPercent(percent: number) {
            switch (percent) {
                case 0: return 'closed';
                case 100: return 'open';
                default: return `${percent}%`;
            }
        }

        function isLockUnlockState(device: Device, state: Device['state']): state is LockUnlockDevice['state'] {
            return isLockUnlock(device);
        }
    });
};
