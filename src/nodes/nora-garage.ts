import { OpenCloseDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { convertValueType, getId, getValue, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-garage', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const { value: openValue, type: openType } =
            convertValueType(RED, config.openvalue, config.openvalueType, { defaultValue: true });
        const { value: closeValue, type: closeType } =
            convertValueType(RED, config.closevalue, config.closevalueType, { defaultValue: false });

        const deviceConfig = noraConfig.setCommon<OpenCloseDevice>({
            id: getId(config),
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
            },
            attributes: {
            },
        });

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, ctx)
            .pipe(
                switchMap(connection => connection.withDevice(deviceConfig, ctx)),
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
            if ('openPercent' in state) {
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
            }
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }
            try {
                const myOpenValue = getValue(RED, this, openValue, openType);
                const myCloseValue = getValue(RED, this, closeValue, closeType);
                const device = await device$.pipe(first()).toPromise();
                if (RED.util.compareObjects(myOpenValue, msg.payload)) {
                    await device.updateState({ openPercent: 100 });
                } else if (RED.util.compareObjects(myCloseValue, msg.payload)) {
                    await device.updateState({ openPercent: 0 });
                } else {
                    await device.updateState(msg.payload);
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
            if ('openPercent' in state) {
                if (state.openPercent === 0) {
                    ctx.state$.next(`(closed)`);
                } else {
                    ctx.state$.next(`(open)`);
                }
            }
        }
    });
};
