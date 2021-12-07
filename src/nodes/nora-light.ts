import {
    BrightnessDevice, ColorSettingDevice,
    Device,
    isBrightness, isColorSetting, OnOffDevice
} from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { convertValueType, getNumberOrDefault, getValue, registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-light', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const brightnessControl = !!config.brightnesscontrol;
        const statepayload = !!config.statepayload;
        const colorControl = !!config.lightcolor;
        const turnOnWhenBrightnessChanges = !!config.turnonwhenbrightnesschanges;
        const { value: onValue, type: onType } = convertValueType(RED, config.onvalue, config.onvalueType, { defaultValue: true });
        const { value: offValue, type: offType } = convertValueType(RED, config.offvalue, config.offvalueType, { defaultValue: false });
        const brightnessOverride = Math.max(0, Math.min(100, Math.round(config.brightnessoverride))) || 0;

        const deviceConfig: Omit<OnOffDevice, 'id'> = {
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
                returnOnOffErrorCodeIfStateAlreadySet: !!config.errorifstateunchaged,
            },
            attributes: {
            },
        };

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
                this.warn('Unable to add ColorSetting trait');
                return;
            }

            deviceConfig.noraSpecific.turnOnWhenColorChanges = turnOnWhenBrightnessChanges;
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

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [
                    state.on ? 'on' : 'off'
                ];

                if (isBrightnessState(deviceConfig, state)) {
                    statuses.push(`${state.brightness}`);
                }

                if (isHsvColor(deviceConfig, state) && 'spectrumHsv' in state?.color) {
                    const hue = state.color.spectrumHsv.hue;
                    const saturation = (state.color.spectrumHsv.saturation ?? 0) * 100;
                    const value = (state.color.spectrumHsv.value ?? 0) * 100;
                    statuses.push(round`H:${hue}° S:${saturation}% V:${value}%`);
                }

                if (isRgbColor(deviceConfig, state) && 'spectrumRgb' in state?.color) {
                    const rgbColor = `#${state.color.spectrumRgb.toString(16).padStart(6, '0')}`;
                    statuses.push(`${rgbColor}`);
                }

                if (isTemperatureColor(deviceConfig, state) && 'temperatureK' in state?.color) {
                    statuses.push(`${state.color.temperatureK}K`);
                }

                update(statuses.join(' '));
            },
            stateChanged: state => {
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
                            payload: state.on && isBrightnessState(deviceConfig, state) ? state.brightness : 0,
                            topic: config.topic
                        });
                    }
                }
            },
            handleNodeInput: async ({ msg, updateState }) => {
                if (!brightnessControl && !colorControl) {
                    const myOnValue = getValue(RED, this, onValue, onType);
                    const myOffValue = getValue(RED, this, offValue, offType);
                    if (RED.util.compareObjects(myOnValue, msg.payload)) {
                        await updateState({ on: true });
                    } else if (RED.util.compareObjects(myOffValue, msg.payload)) {
                        await updateState({ on: false });
                    } else {
                        await updateState(msg?.payload);
                    }
                    return;
                }

                if (await updateState(msg?.payload)) {
                    return;
                }

                const brightness = Math.max(0, Math.min(100, Math.round(msg.payload)));
                if (!isFinite(brightness)) {
                    this.error('Payload must be a number in range 0-100');
                    return;
                }

                if (brightness === 0) {
                    if (brightnessOverride !== 0) {
                        await updateState({
                            on: false,
                            brightness: brightnessOverride,
                        });
                    } else {
                        await updateState({
                            on: false,
                        });
                    }
                } else {
                    await updateState({
                        on: true,
                        brightness: brightness,
                    });
                }
            },
        });

        function isBrightnessState<T extends Device>(device: Pick<T, 'traits'>, state: any): state is BrightnessDevice['state'] {
            return isBrightness(device) && 'brightness' in state;
        }

        function isHsvColor<T extends Device>(device: Pick<T, 'traits'>, state: any): state is ColorSettingDevice['state'] {
            return isColorSetting(device) && 'colorModel' in device.attributes && device.attributes.colorModel === 'hsv' && state?.color;
        }

        function isRgbColor<T extends Device>(device: Pick<T, 'traits'>, state: any): state is ColorSettingDevice['state'] {
            return isColorSetting(device) && 'colorModel' in device.attributes && device.attributes.colorModel === 'rgb' && state?.color;
        }

        function isTemperatureColor<T extends Device>(device: Pick<T, 'traits'>, state: any): state is ColorSettingDevice['state'] {
            return isColorSetting(device) && 'colorTemperatureRange' in device.attributes && state?.color;
        }

        function round(parts: TemplateStringsArray, ...substitutions: any[]) {
            const rounded = substitutions.map(sub => {
                if (typeof sub === 'number') {
                    return Math.round(sub);
                }
                return sub;
            });
            return String.raw(parts, ...rounded);
        }
    });
};
