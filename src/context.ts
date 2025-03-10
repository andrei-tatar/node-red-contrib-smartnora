import { deleteApp, initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, Database, ref, DatabaseReference, child, update, onValue, remove } from 'firebase/database';
import { firstValueFrom, Observable, retry, share, switchMap, timer } from 'rxjs';
import { FIREBASE_CONFIG } from './config';

interface ContextConfiguration {
    email: string;
    password: string;
    group?: string;
}

const ENCODE_MAP = new Map([
    ['.', '%2E'],
    ['#', '%23'],
    ['$', '%24'],
    ['[', '%5B'],
    [']', '%5D'],
    ['/', '%2F'],
]);

const DECODE_MAP = new Map([
    ['%2E', '.'],
    ['%23', '#'],
    ['%24', '$'],
    ['%5B', '['],
    ['%5D', ']'],
    ['%2F', '/'],
]);


class FirebaseContextStorage {
    private db!: Database;
    private contextReferece!: DatabaseReference;
    private cleanup?: () => void;
    private context: {
        [scope: string]: Record<string, any>;
    } = {};

    constructor(private readonly config: ContextConfiguration) {
    }

    async open() {
        this.close();

        const get$ = new Observable<FirebaseApp>(observer => {
            const app = initializeApp(FIREBASE_CONFIG, 'app-context');
            observer.next(app);
            return () => deleteApp(app);
        }).pipe(
            switchMap(async app => {
                const auth = getAuth(app);
                const { user } = await signInWithEmailAndPassword(auth, this.config.email, this.config.password);
                this.db = getDatabase(app);
                this.contextReferece = ref(this.db, `context_store/${user.uid}/${this.encode(this.config.group ?? 'default')}`);
                return this.contextReferece;
            }),
            switchMap(ctxRef => new Observable(observer =>
                onValue(ctxRef, data => {
                    this.context = data.val() ?? {};
                    observer.next(this.context);
                })
            )),
            retry({
                delay: _err => timer(5000),
            }),
            share(),
        );

        const subscription = get$.subscribe();

        await firstValueFrom(get$);

        this.cleanup = () => subscription.unsubscribe();
    }

    close() {
        this?.cleanup?.();
        delete this.cleanup;
    }

    get(scope: string, key: string | string[], callback?: (err: Error | null, ...values: any[]) => void) {
        const getValue = (singleKey: string) => this.parse(this.context[this.encode(scope)]?.[this.encode(singleKey)]);
        if (Array.isArray(key)) {
            const values = key.map(k => getValue(k));
            callback?.(null, ...values);
            return values;
        } else {
            const value = getValue(key);
            callback?.(null, value);
            return value;
        }
    }

    set(scope: string, key: string | string[], value: any | any[], callback?: (err: Error | null) => void) {
        const encodedScope = this.encode(scope);
        const scopeUpdate: Record<string, any> = {};
        const updateValue = (singleKey: string, singleValue: any) => {
            const encodedKey = this.encode(singleKey);
            if (singleValue === null || singleValue === undefined) {
                scopeUpdate[encodedKey] = null;
                delete this.context[encodedScope]?.[encodedKey];
            } else {
                singleValue = JSON.stringify(singleValue);
                this.context[encodedScope] ??= {};
                this.context[encodedScope][encodedKey] = singleValue;
                scopeUpdate[encodedKey] = singleValue;
            }
        };
        if (Array.isArray(key)) {
            for (const [index, k] of key.entries()) {
                updateValue(k, value[index]);
            }
        } else {
            updateValue(key, value);
        }

        const reference = child(this.contextReferece, encodedScope);
        update(reference, scopeUpdate)
            .then(() => callback?.(null))
            .catch(err => callback?.(err));
    }

    keys(scope: string, callback: (err: Error | null, keys?: string[]) => void) {
        const encodedScope = this.encode(scope);
        const keys = Object.keys(this.context[encodedScope] ?? {}).map(k => this.decode(k));
        callback?.(null, keys);
        return keys;
    }

    async delete(scope: string) {
        const encodedScope = this.encode(scope);
        const reference = child(this.contextReferece, encodedScope);
        delete this.context[encodedScope];
        await remove(reference);
    }

    async clean(activeNodes: string[]) {
        const keepScopes = ['global', ...activeNodes].map(n => this.encode(n));
        const scopes = Object.keys(this.context)
            .filter(key => !keepScopes.some(e => key.startsWith(e)));
        await Promise.all(scopes.map(scope => this.delete(scope)));
    }

    private encode(value: string) {
        return value.replace(/[/.#$[\]]/g, m => ENCODE_MAP.get(m) ?? m);
    }

    private decode(value: string) {
        return value.replace(/%[\dA-F]{2}/g, m => DECODE_MAP.get(m) ?? m);
    }

    private parse(value?: string) {
        try {
            return value && JSON.parse(value);
        } catch {
            return null;
        }
    }
}

module.exports = function (config: ContextConfiguration) {
    return new FirebaseContextStorage(config);
};
