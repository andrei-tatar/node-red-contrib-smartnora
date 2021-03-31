import { LockUnlockDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { convertValueType, getId, getValue, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-lock', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
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

        const deviceConfig = noraConfig.setCommon<LockUnlockDevice>({
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
            noraSpecific: {
            },
        });

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, this, stateString$)
            .pipe(
                switchMap(connection => connection.withDevice(deviceConfig)),
                withLocalExecution(noraConfig),
                publishReplay(1),
                refCount(),
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
                    } else {
                        await device.updateState(msg.payload);
                    }
                } else {
                    if (RED.util.compareObjects(myLockValue, msg.payload)) {
                        await device.updateState({ isLocked: true });
                    } else if (RED.util.compareObjects(myUnlockValue, msg.payload)) {
                        await device.updateState({ isLocked: false });
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

        function notifyState(state: LockUnlockDevice['state']) {
            if (state.isJammed) {
                stateString$.next(`(jammed)`);
            } else {
                stateString$.next(`(${state.isLocked ? 'locked' : 'unlocked'})`);
            }
        }
    });
};

