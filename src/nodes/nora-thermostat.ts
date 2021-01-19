import { TemperatureSettingDevice, TemperatureSettingState, ThermostatMode } from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, skip, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { getId, R } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-thermostat', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const close$ = new Subject();
        const stateString$ = new Subject<string>();
        const availableModes: ThermostatMode[] = config.modes.split(',');

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, this, stateString$)
            .pipe(
                switchMap(connection => connection.withDevice<TemperatureSettingDevice>({
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
                    },
                    state: {
                        online: true,
                        thermostatMode: 'off',
                        thermostatTemperatureAmbient: 25,
                        thermostatTemperatureSetpoint: 20,
                    },
                })),
                publishReplay(1),
                refCount(),
                takeUntil(close$),
            );

        device$.pipe(
            switchMap(d => d.state$),
            tap((state) => notifyState(state)),
            skip(1),
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
                await device.updateStateSafer(msg?.payload, [
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
                this.warn(err);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: TemperatureSettingState) {
            const setpoint = state.thermostatMode === 'heatcool' ?
                R`${state.thermostatTemperatureSetpointLow}-${state.thermostatTemperatureSetpointHigh}` :
                R`${state.thermostatTemperatureSetpoint}`;

            stateString$.next(
                R`(${state.thermostatMode}/T:${state.thermostatTemperatureAmbient}/S:${setpoint})`
            );
        }
    });
};
