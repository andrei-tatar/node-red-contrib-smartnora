export const TEMPERATURE_SETTING_STATE_MAPPING = [
    {
        from: 'mode',
        to: 'thermostatMode',
    },
    {
        from: 'activeMode',
        to: 'activeThermostatMode',
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
];

export const FAN_STATE_MAPPING = (percentageControl: boolean) => [
    {
        from: 'speed',
        to: percentageControl
            ? 'currentFanSpeedPercent'
            : 'currentFanSpeedSetting',
    }
];
