import { OpenCloseDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { getId, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-blinds', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const deviceConfig = noraConfig.setCommon<OpenCloseDevice>({
            id: getId(config),
            type: 'action.devices.types.BLINDS',
            traits: ['action.devices.traits.OpenClose'],
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            noraSpecific: {
            },
            state: {
                online: true,
                openPercent: 100,
            },
            attributes: {
            },
        }, config);

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
                this.send({
                    payload: {
                        openPercent: adjustPercent(state.openPercent),
                    },
                    topic: config.topic
                });
            }
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }
            try {
                const device = await device$.pipe(first()).toPromise();
                if (typeof msg?.payload?.openPercent === 'number') {
                    msg.payload.openPercent = adjustPercent(msg.payload.openPercent);
                }
                await device.updateState(msg?.payload);
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: OpenCloseDevice['state']) {
            ctx.state$.next(`(${'openPercent' in state && adjustPercent(state.openPercent)}%)`);
        }

        function adjustPercent(openPercent: number) {
            return config.invert ? 100 - openPercent : openPercent;
        }
    });
};

