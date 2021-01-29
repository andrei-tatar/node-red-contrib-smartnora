export interface GetSafeUpdateParams {
    update: any;
    currentState: any;
    safeUpdateObject: any;
    isValid: () => boolean;
    mapping?: { from: keyof any, to: keyof any }[];
    path?: string;
    warn?: (prop: string) => void;
}

export function getSafeUpdate({
    update,
    currentState,
    safeUpdateObject,
    isValid,
    mapping,
    path = 'msg.payload.',
    warn,
}: GetSafeUpdateParams) {
    for (const [key, v] of Object.entries(update)) {
        let updateValue: any = v;
        const updateKey = mapping?.find(m => m.from === key)?.to ?? key;

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
            // hackish way to preserve accuracy on sat/val
            const skipRoundingNumbers = path.indexOf('color') >= 0;

            if (!skipRoundingNumbers) {
                // round up temperature and humidity to 1 digit as assistant doesn't support accuracy better than .5
                // helps to keep the updates lower
                updateValue = Math.round(updateValue * 10) / 10;
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
                path: `${path}${key}.`
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
