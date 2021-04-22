import { TemperatureSettingDevice } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { getId, R, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-thermostat', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const availableModes = config.modes.split(',');

        const deviceConfig = noraConfig.setCommon<TemperatureSettingDevice>({
            id: getId(config),
            type: 'action.devices.types.THERMOSTAT',
            traits: ['action.devices.traits.TemperatureSetting'],
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            attributes: {
                availableThermostatModes: availableModes,
                thermostatTemperatureUnit: config.unit,
                bufferRangeCelsius: parseInt(config.bufferRangeCelsius, 10) || undefined,
                commandOnlyTemperatureSetting: config.commandOnly ?? undefined,
                queryOnlyTemperatureSetting: config.queryOnly ?? undefined,
                thermostatTemperatureRange: {
                    minThresholdCelsius: parseInt(config.rangeMin, 10) || 10,
                    maxThresholdCelsius: parseInt(config.rangeMax, 10) || 32,
                },
            },
            state: {
                online: true,
                thermostatMode: 'off',
                thermostatTemperatureAmbient: 25,
                thermostatTemperatureSetpoint: 20,
            },
            noraSpecific: {
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
            notifyState(state);
            this.send({
                payload: {
                    mode: state.thermostatMode,
                    setpoint: 'thermostatTemperatureSetpoint' in state ? state.thermostatTemperatureSetpoint : undefined,
                    setpointLow: 'thermostatTemperatureSetpointLow' in state ? state.thermostatTemperatureSetpointLow : undefined,
                    setpointHigh: 'thermostatTemperatureSetpointHigh' in state ? state.thermostatTemperatureSetpointHigh : undefined,
                },
                topic: config.topic,
            });
        });

        this.on('input', async msg => {
            if (config.passthru) {
                this.send(msg);
            }

            try {
                const device = await device$.pipe(first()).toPromise();
                await device.updateState(msg?.payload, [
                    {
                        from: 'mode',
                        to: 'thermostatMode',
                    },
                    {
                        from: 'setpoint',
                        to: 'thermostatTemperatureSetpoint',
                    },
                    {
                        from: 'setpointHigh',
                        to: 'thermostatTemperatureSetpointHigh',
                    },
                    {
                        from: 'setpointLow',
                        to: 'thermostatTemperatureSetpointLow',
                    },
                    {
                        from: 'temperature',
                        to: 'thermostatTemperatureAmbient',
                    },
                    {
                        from: 'humidity',
                        to: 'thermostatHumidityAmbient',
                    },
                ]);
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: TemperatureSettingDevice['state']) {
            const setpoint = state.thermostatMode === 'heatcool' ?
                R`${state.thermostatTemperatureSetpointLow}-${state.thermostatTemperatureSetpointHigh}` :
                R`${state.thermostatTemperatureSetpoint}`;

            ctx.state$.next(
                R`(${state.thermostatMode}/T:${state.thermostatTemperatureAmbient}/S:${setpoint})`
            );
        }
    });
};
