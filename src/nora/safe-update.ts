export interface GetSafeUpdateParams {
    update: any;
    currentState: any;
    safeUpdateObject: any;
    isValid: () => boolean;
    mapping?: { from: keyof any; to: keyof any }[];
    path?: string;
    statePath?: string;
    warn?: (prop: string) => void;
}

const skipRoundingStatePaths = new Set<string>([
    'color.spectrumHsv.hue',
    'color.spectrumHsv.saturation',
    'color.spectrumHsv.value',
]);

const roundTo = new Map<string, number>([
    ['thermostatTemperatureSetpointLow', 2],
    ['thermostatTemperatureSetpointHigh', 2],
    ['thermostatTemperatureSetpoint', 2],
    ['thermostatTemperatureAmbient', 2],
    ['thermostatHumidityAmbient', 1],
    ['humidityAmbientPercent', 1],
    ['temperatureAmbientCelsius', 2],
    ['currentFanSpeedPercent', 1],
]);

const keepPathsIfSameValue: RegExp[] = [
    /^openState\.\d+\.openDirection$/,
    /^currentSensorStateData\.\d+\.name$/
];

const arrayItemKeyMap = new Map<string, string>([
    ['openState', 'openDirection'],
    ['currentSensorStateData', 'name'],
]);

export function getSafeUpdate({
    update,
    currentState,
    safeUpdateObject,
    isValid,
    mapping,
    path = 'msg.payload.',
    statePath,
    warn,
}: GetSafeUpdateParams) {
    for (const [key, v] of Object.entries(update)) {
        if (typeof key !== 'string') {
            continue;
        }

        let updateValue: any = v;
        const updateKey = mapping?.find(m => m.from === key)?.to ?? key;
        const currentStatePath = statePath ? `${statePath}.${String(updateKey)}` : String(updateKey);

        let previousValue: any;
        const keyName = statePath && arrayItemKeyMap.get(statePath);
        if (keyName && Array.isArray(currentState)) {
            const keyValue = (v as any)[keyName];
            previousValue = currentState.find(pv => pv[keyName] === keyValue);
            if (!previousValue) {
                // there is no previous item with this key, we don't add a new one on updates
                warn?.(`${path}${key}.${keyName}[${keyValue}]`);
                continue;
            }
        } else {
            previousValue = currentState[updateKey];
        }
        if (typeof previousValue !== typeof updateValue) {
            if (typeof previousValue === 'number') {
                updateValue = +updateValue;
            }

            if (typeof previousValue === 'boolean') {
                updateValue = !!updateValue;
            }
        }

        if (typeof updateValue === 'number') {
            const skipRoundingNumbers = skipRoundingStatePaths.has(currentStatePath);
            if (!skipRoundingNumbers) {
                const roundToDigits = roundTo.get(currentStatePath) ?? 10;
                updateValue = Math.round(updateValue * roundToDigits) / roundToDigits;
            }
        }

        if (typeof updateValue === 'object' && typeof previousValue === 'object') {
            const updateChild = Array.isArray(updateValue) ? [] : {};
            // set it for validation
            const remove = append(safeUpdateObject, updateKey, updateChild);
            getSafeUpdate({
                update: updateValue,
                currentState: previousValue,
                safeUpdateObject: updateChild,
                isValid,
                mapping,
                path: `${path}${key}.`,
                statePath: currentStatePath,
                warn,
            });
            remove();
            updateValue = updateChild;
        }

        const skipRemove = keepPathsIfSameValue.some(t => t.test(currentStatePath));
        if (!skipRemove && updateValue === previousValue) {
            // if the value hasn't changed, don't append
            updateValue = undefined;
        }

        if (statePath && updateValue && arrayItemKeyMap.has(statePath) && Object.keys(updateValue).length === 1) {
            // if the parrent is an array item and the only item in the object is the key, there are no changes
            updateValue = undefined;
        }

        if (Array.isArray(updateValue) && updateValue.length === 0) {
            // if this is an empty array, there are no changes
            updateValue = undefined;
        }

        if (updateValue !== undefined) {
            const remove = append(safeUpdateObject, updateKey, updateValue);
            if (!isValid()) {
                remove();
                warn?.(`${path}${key}`);
            }
        }
    }
}

function append(parent: any, key: string | number | symbol, child: any) {
    if (Array.isArray(parent)) {
        parent.push(child);
        return () => {
            const index = parent.indexOf(child);
            parent.splice(index, 1);
        };
    } else {
        parent[key] = child;
        return () => {
            delete parent[key];
        };
    }
}
