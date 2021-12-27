import { validate } from '@andrei-tatar/nora-firebase-common';
import * as chai from 'chai';
import { getSafeUpdate } from './safe-update';
import { TEMPERATURE_SETTING_STATE_MAPPING } from '../nodes/mapping';

const expect = chai.expect;
describe('getSafeUpdate', () => {

    it('should convert text to numbers if current state has them as numbers', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                test: '45',
                test2: '123',
                child: {
                    test: '45',
                    test2: '123',
                },
            },
            currentState: {
                test: 123,
                test2: 'text',
                child: {
                    test: 123,
                    test2: 'text',
                },
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            test: 45,
            test2: '123',
            child: {
                test: 45,
                test2: '123',
            }
        });
    });

    it('should return only the changes', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                willChange: 3,
                child: {
                    willChange: 4,
                    wontChange: '2',
                },
            },
            currentState: {
                willChange: 1,
                wontChange: 1,
                child: {
                    willChange: 2,
                    wontChange: 2,
                },
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            willChange: 3,
            child: {
                willChange: 4,
            },
        });
    });

    it('should keep openState[$].openDirection properties even if they dont change', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                openState: [
                    { openDirection: 'LEFT', openPercent: 50 },
                    { openDirection: 'RIGHT', openPercent: 50 }
                ]
            },
            currentState: {
                openState: [
                    { openDirection: 'LEFT', openPercent: 0 },
                    { openDirection: 'RIGHT', openPercent: 0 }
                ]
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            openState: [
                { openDirection: 'LEFT', openPercent: 50 },
                { openDirection: 'RIGHT', openPercent: 50 }
            ]
        });
    });

    it('should convert properties to boolean if current state has them as boolean', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                online: 1,
                child: {
                    online2: 'on',
                },
            },
            currentState: {
                online: false,
                child: {
                    online2: false,
                },
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            online: true,
            child: {
                online2: true,
            },
        });
    });

    it('should round numbers from some paths', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                color: {
                    spectrumHsv: {
                        hue: 1.1234,
                        saturation: 2.1234,
                        value: 3.1234,
                        shouldRound: 4.1234,
                    },
                },
                thermostatTemperatureAmbient: 22.34,
                thermostatHumidityAmbient: 33.123,
                shouldRound: 33.345,
                temperatureAmbientCelsius: 22.36,
                humidityAmbientPercent: 50.1,
            },
            currentState: {
                color: {
                    spectrumHsv: {
                        hue: 1,
                        saturation: 2,
                        value: 3,
                        shouldRound: 4,
                    },
                },
                thermostatTemperatureAmbient: 22,
                thermostatHumidityAmbient: 31,
                shouldRound: 32,
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            color: {
                spectrumHsv: {
                    hue: 1.1234,
                    saturation: 2.1234,
                    value: 3.1234,
                    shouldRound: 4.1,
                },
            },
            thermostatTemperatureAmbient: 22.3,
            thermostatHumidityAmbient: 33,
            shouldRound: 33.3,
            temperatureAmbientCelsius: 22.4,
            humidityAmbientPercent: 50,
        });
    });


    describe('with validation', () => {
        it('should remove invalid properties and warn', () => {
            const safeUpdate = {};
            const warnings: string[] = [];

            getSafeUpdate({
                update: {
                    missingProperty: 'this should not be copied',
                    color: {
                        missingProperty: 'this should not be copied',
                        spectrumHsv: {
                            missingProperty: 'this should not be copied',
                            hue: 3,
                        },
                    },
                },
                currentState: {
                    online: true,
                    color: {
                        spectrumHsv: {
                            hue: 2,
                            saturation: 3,
                            value: .5
                        },
                    },
                },
                isValid: () => validate(['action.devices.traits.ColorSetting'], 'state-update', safeUpdate).valid,
                warn: prop => warnings.push(prop),
                safeUpdateObject: safeUpdate,
            });

            expect(safeUpdate).to.deep.equal({
                color: {
                    spectrumHsv: {
                        hue: 3,
                    },
                },
            });
            expect(warnings).to.have.members([
                'msg.payload.missingProperty',
                'msg.payload.color.missingProperty',
                'msg.payload.color.spectrumHsv.missingProperty',
            ]);
        });

        it('should update ac mode', () => {
            const safeUpdate = {};
            const warnings: string[] = [];

            getSafeUpdate({
                update: {
                    mode: 'cool',
                },
                currentState: {
                    online: true,
                    thermostatMode: 'off',
                    thermostatTemperatureAmbient: 25,
                    thermostatTemperatureSetpoint: 20,
                    currentFanSpeedPercent: 100,
                },
                isValid: () => validate([
                    'action.devices.traits.TemperatureSetting',
                    'action.devices.traits.FanSpeed'
                ], 'state-update', safeUpdate).valid,
                warn: prop => warnings.push(prop),
                safeUpdateObject: safeUpdate,
                mapping: [...TEMPERATURE_SETTING_STATE_MAPPING],
            });

            expect(safeUpdate).to.deep.equal({
                thermostatMode: 'cool',
            });
            expect(warnings).to.be.empty;
        });

        it('should update sensor state', () => {
            const safeUpdate = {};
            const warnings: string[] = [];

            getSafeUpdate({
                update: {
                    currentSensorStateData: [{
                        name: 'CarbonMonoxideLevel',
                        currentSensorState: 'unknown',
                        rawValue: 150,
                    }]
                },
                currentState: {
                    online: true,
                    currentSensorStateData: [{
                        name: 'AirQuality',
                        currentSensorState: 'healthy',
                    }, {
                        name: 'CarbonMonoxideLevel',
                        currentSensorState: 'unknown',
                        rawValue: 200.0
                    }]
                },
                isValid: () => validate([
                    'action.devices.traits.SensorState',
                ], 'state-update', safeUpdate).valid,
                warn: prop => warnings.push(prop),
                safeUpdateObject: safeUpdate,
                mapping: [...TEMPERATURE_SETTING_STATE_MAPPING],
            });

            expect(safeUpdate).to.deep.equal({
                currentSensorStateData: [{
                    name: 'CarbonMonoxideLevel',
                    rawValue: 150,
                }]
            });
            expect(warnings).to.be.empty;
        });

        it('should return empty object if no change on sensor state', () => {
            const safeUpdate = {};
            const warnings: string[] = [];

            getSafeUpdate({
                update: {
                    currentSensorStateData: [{
                        name: 'CarbonMonoxideLevel',
                        currentSensorState: 'unknown',
                        rawValue: 150,
                    }]
                },
                currentState: {
                    online: true,
                    currentSensorStateData: [{
                        name: 'AirQuality',
                        currentSensorState: 'healthy',
                    }, {
                        name: 'CarbonMonoxideLevel',
                        currentSensorState: 'unknown',
                        rawValue: 150.0
                    }]
                },
                isValid: () => validate([
                    'action.devices.traits.SensorState',
                ], 'state-update', safeUpdate).valid,
                warn: prop => warnings.push(prop),
                safeUpdateObject: safeUpdate,
            });

            expect(safeUpdate).to.deep.equal({});
            expect(warnings).to.be.empty;
        });

        it('should return empty object if no change on sensor state', () => {
            const safeUpdate = {};
            const warnings: string[] = [];

            getSafeUpdate({
                update: {
                    currentSensorStateData: [{
                        name: 'CarbonMonoxideLevel',
                        currentSensorState: 'unknown',
                        rawValue: 150,
                    }]
                },
                currentState: {
                    online: true,
                    currentSensorStateData: [{
                        name: 'AirQuality',
                        currentSensorState: 'healthy',
                    }]
                },
                isValid: () => validate([
                    'action.devices.traits.SensorState',
                ], 'state-update', safeUpdate).valid,
                warn: prop => warnings.push(prop),
                safeUpdateObject: safeUpdate,
            });

            expect(safeUpdate).to.deep.equal({});
            expect(warnings).to.have.members([
                'msg.payload.currentSensorStateData.0.name[CarbonMonoxideLevel]',
            ]);
        });
    });
});

