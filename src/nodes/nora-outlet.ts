import { OnOffDevice } from '@andrei-tatar/nora-firebase-common';
import { firstValueFrom, Subject } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface, singleton } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { convertValueType, getId, getValue, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-outlet', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject<void>();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const { value: onValue, type: onType } = convertValueType(RED, config.onvalue, config.onvalueType, { defaultValue: true });
        const { value: offValue, type: offType } = convertValueType(RED, config.offvalue, config.offvalueType, { defaultValue: false });

        const deviceConfig = noraConfig.setCommon<OnOffDevice>({
            id: getId(config),
            type: 'action.devices.types.OUTLET',
            traits: ['action.devices.traits.OnOff'],
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            state: {
                online: true,
                on: false,
            },
            attributes: {
            },
            noraSpecific: {
            }
        }, config);

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
            const value = state.on;
            this.send({
                payload: getValue(RED, this, value ? onValue : offValue, value ? onType : offType),
                topic: config.topic
            });
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }
            const myOnValue = getValue(RED, this, onValue, onType);
            const myOffValue = getValue(RED, this, offValue, offType);

            try {
                const device = await firstValueFrom(device$);
                if (RED.util.compareObjects(myOnValue, msg.payload)) {
                    await device.updateState({ on: true });
                } else if (RED.util.compareObjects(myOffValue, msg.payload)) {
                    await device.updateState({ on: false });
                }
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: OnOffDevice['state']) {
            ctx.state$.next(`(${state.on ? 'on' : 'off'})`);
        }
    });
};

