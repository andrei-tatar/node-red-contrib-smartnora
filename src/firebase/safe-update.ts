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

const keepPathsIfSameValue: RegExp[] = [
    /^openState\.\d+\.openDirection$/
];

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
