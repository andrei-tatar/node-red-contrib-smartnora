import { LockUnlockDevice, LockUnlockState } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, skip, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { convertValueType, getId, getValue } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-lock', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const stateString$ = new Subject<string>();

        const { value: lockValue, type: lockType } = convertValueType(RED, config.lockValue,
            config.lockValueType, { defaultValue: true });
        const { value: unlockValue, type: unlockType } = convertValueType(RED, config.unlockValue,
            config.unlockValueType, { defaultValue: false });

        const { value: jammedValue, type: jammedType } = convertValueType(RED, config.jammedValue,
            config.jammedValueType, { defaultValue: true });
        const { value: unjammedValue, type: unjammedType } = convertValueType(RED, config.unjammedValue,
            config.unjammedValueType, { defaultValue: false });

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, this, stateString$)
            .pipe(
                switchMap(connection => connection.createDevice<LockUnlockDevice>({
                    id: getId(config),
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
                })),
                publishReplay(1),
                refCount(),
                takeUntil(close$),
            );


        device$.pipe(
            switchMap(d => d.state$),
            tap(state => notifyState(state)),
            skip(1),
            takeUntil(close$),
        ).subscribe(state => {
            const lvalue = state.isLocked;
            if (!state.isJammed) {
                this.send({
                    payload: getValue(RED, this, lvalue ? lockValue : unlockValue, lvalue ? lockType : unlockType),
                    topic: config.topic,
                });
            } else {
                this.error('Lock is jammed');
            }
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }

            const myLockValue = getValue(RED, this, lockValue, lockType);
            const myUnlockValue = getValue(RED, this, unlockValue, unlockType);
            try {
                const device = await device$.pipe(first()).toPromise();
                if (msg.topic?.toLowerCase() === 'jammed') {
                    const myJammedValue = getValue(RED, this, jammedValue, jammedType);
                    const myUnjammedValue = getValue(RED, this, unjammedValue, unjammedType);
                    if (RED.util.compareObjects(myJammedValue, msg.payload)) {
                        await device.updateState({ isJammed: true });
                    } else if (RED.util.compareObjects(myUnjammedValue, msg.payload)) {
                        await device.updateState({ isJammed: false });
                    }
                } else {
                    if (RED.util.compareObjects(myLockValue, msg.payload)) {
                        await device.updateState({ isLocked: true });
                    } else if (RED.util.compareObjects(myUnlockValue, msg.payload)) {
                        await device.updateState({ isLocked: false });
                    }
                }
            } catch (err) {
                this.warn(err);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: LockUnlockState) {
            if (state.isJammed) {
                stateString$.next(`(jammed)`);
            } else {
                stateString$.next(`(${state.isLocked ? 'locked' : 'unlocked'})`);
            }
        }
    });
};

