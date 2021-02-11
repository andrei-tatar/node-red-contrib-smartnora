export interface GetSafeUpdateParams {
    update: any;
    currentState: any;
    safeUpdateObject: any;
    isValid: () => boolean;
    mapping?: { from: keyof any, to: keyof any }[];
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
    ['thermostatTemperatureAmbient', 2],
    ['thermostatHumidityAmbient', 1]
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
        if (typeof key !== 'string') { continue; }

        let updateValue: any = v;
        const updateKey = mapping?.find(m => m.from === key)?.to ?? key;
        const currentStatePath = statePath ? `${statePath}.${String(updateKey)}` : String(updateKey);

        const previousValue = currentState[updateKey];
        if (typeof previousValue !== typeof updateValue) {
            if (typeof previousValue === 'number') {
                updateValue = +updateValue;
            }

            if (typeof previousValue === 'boolean') {
                updateValue = !!updateValue;
            }
        }

        if (typeof previousValue === 'number') {
            const skipRoundingNumbers = skipRoundingStatePaths.has(currentStatePath);
            if (!skipRoundingNumbers) {
                const roundToDigits = roundTo.get(currentStatePath) ?? 10;
                updateValue = Math.round(updateValue * roundToDigits) / roundToDigits;
            }
        }

        if (typeof updateValue === 'object' && typeof previousValue === 'object') {
            const updateChild = {};
            safeUpdateObject[updateKey] = updateChild; // set it for validation
            getSafeUpdate({
                update: updateValue,
                currentState: previousValue,
                safeUpdateObject: updateChild,
                isValid,
                mapping,
                path: `${path}${key}.`,
                statePath: currentStatePath
            });
            delete safeUpdateObject[updateKey];
            updateValue = updateChild;
        }

        if (updateValue !== undefined) {
            safeUpdateObject[updateKey] = updateValue;
            if (!isValid()) {
                delete safeUpdateObject[updateKey];
                warn?.(`${path}${key}`);
            }
        }
    }
}
