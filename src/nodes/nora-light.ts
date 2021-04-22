import {
    BrightnessDevice, ColorSettingDevice,
    Device,
    isBrightness, isColorSetting, OnOffDevice
} from '@andrei-tatar/nora-firebase-common';
import { Subject } from 'rxjs';
import { first, publishReplay, refCount, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseConnection } from '../firebase/connection';
import { DeviceContext } from '../firebase/device-context';
import { convertValueType, getId, getNumberOrDefault, getValue, R, withLocalExecution } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-light', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) { return; }

        const brightnessControl = !!config.brightnesscontrol;
        const statepayload = !!config.statepayload;
        const colorControl = !!config.lightcolor;
        const turnOnWhenBrightnessChanges = !!config.turnonwhenbrightnesschanges;
        const { value: onValue, type: onType } = convertValueType(RED, config.onvalue, config.onvalueType, { defaultValue: true });
        const { value: offValue, type: offType } = convertValueType(RED, config.offvalue, config.offvalueType, { defaultValue: false });
        const brightnessOverride = Math.max(0, Math.min(100, Math.round(config.brightnessoverride))) || 0;

        const close$ = new Subject();

        const deviceConfig = noraConfig.setCommon<OnOffDevice>({
            id: getId(config),
            type: 'action.devices.types.LIGHT',
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
            noraSpecific: {
            },
            attributes: {
            },
        }, config);

        if (brightnessControl) {
            deviceConfig.traits.push('action.devices.traits.Brightness');
            if (isBrightness(deviceConfig)) {
                deviceConfig.state.brightness = 100;
                deviceConfig.noraSpecific.turnOnWhenBrightnessChanges = turnOnWhenBrightnessChanges;
            }
        }

        const colorType = config.colortype ?? 'hsv';
        if (!['rgb', 'hsv', 'temperature'].includes(colorType)) {
            this.warn(`Invalid color type ${colorType}`);
            return;
        }

        if (colorControl) {
            deviceConfig.traits.push('action.devices.traits.ColorSetting');
            if (!isColorSetting(deviceConfig)) {
                this.warn(`Unable to add ColorSetting trait`);
                return;
            }

            switch (colorType) {
                case 'hsv':
                    deviceConfig.attributes = {
                        commandOnlyColorSetting: config.commandonlycolor ?? false,
                        colorModel: 'hsv',
                    };
                    deviceConfig.state.color = {
                        spectrumHsv: {
                            hue: 0,
                            saturation: 0,
                            value: 1,
                        },
                    };
                    break;
                case 'rgb':
                    deviceConfig.attributes = {
                        commandOnlyColorSetting: config.commandonlycolor ?? false,
                        colorModel: 'rgb',
                    };
                    deviceConfig.state.color = {
                        spectrumRgb: 0,
                    };
                    break;
                case 'temperature':
                    const tempMin = getNumberOrDefault(config.temperaturemin, 2700);
                    const tempMax = getNumberOrDefault(config.temperaturemax, 5500);
                    deviceConfig.attributes = {
                        commandOnlyColorSetting: config.commandonlycolor ?? false,
                        colorTemperatureRange: {
                            temperatureMinK: tempMin,
                            temperatureMaxK: tempMax,
                        },
                    };
                    deviceConfig.state.color = {
                        temperatureK: tempMin,
                    };
                    break;
            }
        }

        const ctx = new DeviceContext(this);
        ctx.update(close$);

        const device$ = FirebaseConnection
            .withLogger(RED.log)
            .fromConfig(noraConfig, ctx)
            .pipe(
                switchMap(connection =>
                    connection.withDevice<OnOffDevice & ColorSettingDevice & BrightnessDevice>(deviceConfig as any, ctx)),
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
        ).subscribe((state) => {
            if (!brightnessControl && !colorControl) {
                const value = state.on;
                this.send({
                    payload: getValue(RED, this, value ? onValue : offValue, value ? onType : offType),
                    topic: config.topic
                });
            } else {
                if (statepayload || colorControl) {
                    this.send({
                        payload: { ...state },
                        topic: config.topic
                    });
                } else {
                    this.send({
                        payload: state.on && 'brightness' in state ? state.brightness : 0,
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
                const device = await device$.pipe(first()).toPromise();
                if (!brightnessControl) {
                    const myOnValue = getValue(RED, this, onValue, onType);
                    const myOffValue = getValue(RED, this, offValue, offType);
                    if (RED.util.compareObjects(myOnValue, msg.payload)) {
                        await device.updateState({ on: true });
                    } else if (RED.util.compareObjects(myOffValue, msg.payload)) {
                        await device.updateState({ on: false });
                    }
                    return;
                }

                if (await device.updateState(msg?.payload)) {
                    return;
                }

                const brightness = Math.max(0, Math.min(100, Math.round(msg.payload)));
                if (!isFinite(brightness)) {
                    this.error('Payload must be a number in range 0-100');
                    return;
                }

                if (brightness === 0) {
                    if (brightnessOverride !== 0) {
                        await device.updateState({
                            on: false,
                            brightness: brightnessOverride,
                        });
                    } else {
                        await device.updateState({
                            on: false,
                        });
                    }
                } else {
                    await device.updateState({
                        on: true,
                        brightness: brightness,
                    });
                }
            } catch (err) {
                this.warn(`while updating state ${err.message}: ${err.stack}`);
            }
        });

        this.on('close', () => {
            close$.next();
            close$.complete();
        });

        function notifyState(state: OnOffDevice['state'] & BrightnessDevice['state'] & ColorSettingDevice['state']) {
            let stateString = state.on ? 'on' : 'off';

            if (brightnessControl && 'brightness' in state) {
                stateString += ` ${state.brightness}`;
            }

            if (isHsvColor(deviceConfig, state) && 'spectrumHsv' in state?.color) {
                stateString += R` hue: ${state.color.spectrumHsv.hue}°`;
                stateString += R` sat: ${(state.color.spectrumHsv.saturation ?? 0) * 100}%`;
                stateString += R` val: ${(state.color.spectrumHsv.value ?? 0) * 100}%`;
            }

            if (isRgbColor(deviceConfig, state) && 'spectrumRgb' in state?.color) {
                const rgbColor = `#${state.color.spectrumRgb.toString(16).padStart(6, '0')}`;
                stateString += ` ${rgbColor}`;
            }

            if (isTemperatureColor(deviceConfig, state) && 'temperatureK' in state?.color) {
                stateString += ` ${state.color.temperatureK}K`;
            }

            ctx.state$.next(`(${stateString})`);
        }

        function isHsvColor<T extends Device>(device: T, state: any): state is ColorSettingDevice['state'] {
            return isColorSetting(device) && 'colorModel' in device.attributes && device.attributes.colorModel === 'hsv' && state?.color;
        }

        function isRgbColor<T extends Device>(device: T, state: any): state is ColorSettingDevice['state'] {
            return isColorSetting(device) && 'colorModel' in device.attributes && device.attributes.colorModel === 'rgb' && state?.color;
        }

        function isTemperatureColor<T extends Device>(device: T, state: any): state is ColorSettingDevice['state'] {
            return isColorSetting(device) && 'colorTemperatureRange' in device.attributes && state?.color;
        }
    });
};
