import { EMPTY, merge, MonoTypeOperatorFunction, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConfigNode } from '..';
import { FirebaseDevice } from '../firebase/device';
import { LocalExecution } from '../local-execution/local-execution';

export function convertValueType(RED: any, value: any, type: any,
    { defaultType = 'bool', defaultValue = false }: { defaultType?: string, defaultValue?: any } = {}) {
    if (type === 'flow' || type === 'global') {
        try {
            const parts = RED.util.normalisePropertyExpression(value);
            if (parts.length === 0) {
                throw new Error();
            }
        } catch (err) {
            value = defaultValue;
            type = defaultType;
        }
    }
    return { value, type };
}

export function getValue(RED: any, node: any, value: any, type: any) {
    if (type === 'date') {
        return Date.now();
    } else {
        return RED.util.evaluateNodeProperty(value, type, node);
    }
}

export function getId({ id }: { id: string }) {
    return id.replace('.', ':');
}

export function R(parts: TemplateStringsArray, ...substitutions: any[]) {
    const rounded = substitutions.map(sub => {
        if (typeof sub === 'number') {
            return Math.round(sub * 10) / 10;
        }
        return sub;
    });
    return String.raw(parts, ...rounded);
}

export function withLocalExecution<T>(config: ConfigNode): MonoTypeOperatorFunction<T> {
    return source => source.pipe(
        switchMap(device => {
            if (!(device instanceof FirebaseDevice)) {
                throw new Error('device must derive FirebaseDevice');
            }

            return merge(
                config.localExecution
                    ? LocalExecution.instance.registerDeviceForLocalExecution(device)
                    : EMPTY,
                of(device)
            );
        }),
    );
}

export function getNumberOrDefault(a: any, defaultValue = 0) {
    const nr = +a;
    if (isFinite(nr)) { return nr; }
    return defaultValue;
}
