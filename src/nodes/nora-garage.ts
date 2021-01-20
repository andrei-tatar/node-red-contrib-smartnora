import { OpenCloseDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, skip, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { convertValueType, getId, getValue } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-garage', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const stateString$ = new Subject<string>();

        const { value: openValue, type: openType } =
            convertValueType(RED, config.openvalue, config.openvalueType, { defaultValue: true });
        const { value: closeValue, type: closeType } =
            convertValueType(RED, config.closevalue, config.closevalueType, { defaultValue: false });

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, this, stateString$)
            .pipe(
                switchMap(connection => connection.withDevice<OpenCloseDevice>({
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
                }
            } catch (err) {
                this.warn(err);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: OpenCloseDevice['state']) {
            if ('openPercent' in state) {
                if (state.openPercent === 0) {
                    stateString$.next(`(closed)`);
                } else {
                    stateString$.next(`(open)`);
                }
            }
        }
    });
};
