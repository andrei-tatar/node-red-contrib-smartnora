import { describe, expect, it, jest } from '@jest/globals';
import { registerNoraDevice } from './util';

jest.mock('./util', () => ({ registerNoraDevice: jest.fn() }));
const registerThermostat = jest.requireActual<(RED: any) => void>('./nora-thermostat');

describe('thermostat configuration', () => {
    function attributes(config: Record<string, unknown>) {
        let create: any;
        const RED = { nodes: {
            registerType: (_name: string, constructor: any) => { create = constructor; },
            createNode: jest.fn(),
            getNode: () => ({ valid: true }),
        } };
        registerThermostat(RED);
        create.call({}, { modes: 'off,heatcool', unit: 'C', ...config });
        const calls = (registerNoraDevice as jest.Mock).mock.calls;
        return (calls[calls.length - 1][3] as any).deviceConfig.attributes;
    }

    it('preserves fractional range limits and minimum buffer', () => {
        const result = attributes({ rangeMin: '-0.5', rangeMax: '30.5', bufferRangeCelsius: '0.5' });
        expect(result.thermostatTemperatureRange).toEqual({ minThresholdCelsius: -0.5, maxThresholdCelsius: 30.5 });
        expect(result.bufferRangeCelsius).toBe(0.5);
    });

    it('preserves integer values and omitted optional settings', () => {
        const result = attributes({ rangeMin: '10', rangeMax: '32', bufferRangeCelsius: '2' });
        expect(result.thermostatTemperatureRange).toEqual({ minThresholdCelsius: 10, maxThresholdCelsius: 32 });
        expect(result.bufferRangeCelsius).toBe(2);
        const empty = attributes({ rangeMin: '', rangeMax: '', bufferRangeCelsius: '' });
        expect(empty.thermostatTemperatureRange).toBeUndefined();
        expect(empty.bufferRangeCelsius).toBeUndefined();
    });
});
