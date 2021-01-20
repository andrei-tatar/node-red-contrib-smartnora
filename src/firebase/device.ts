import { Device } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { concat, defer, merge, Observable } from 'rxjs';
import { filter, first, ignoreElements, publishReplay, refCount } from 'rxjs/operators';
import { FirebaseSync } from './sync';

export class FirebaseDevice<T extends Device = Device> {
    private onDisconnectRule?: firebase.database.OnDisconnect;
    private pendingUpdates: object | null = null;
    private updatesSuspended = true;

    state$ = new Observable<T['state']>(observer => {
        const handler = (snapshot: firebase.database.DataSnapshot) => {
            observer.next(snapshot.val());
        };
        this.state.on('value', handler);
        return () => this.state.off('value', handler);
    }).pipe(
        filter(v => !!v && typeof v === 'object'),
        publishReplay(1),
        refCount(),
    );

    updates$ = concat(
        defer(async () => {
            this.onDisconnectRule?.cancel();
            this.onDisconnectRule = this.state.child('online').onDisconnect();
            await this.onDisconnectRule.set(false);
        }),
        merge(
            defer(async () => {
                let pendingUpdates = this.pendingUpdates;
                while (pendingUpdates != null) {
                    this.pendingUpdates = null;
                    await this.sync.updateState(this.device.id, pendingUpdates);
                    pendingUpdates = this.pendingUpdates;
                }
                this.updatesSuspended = false;
            }),
            new Observable(_ => {
                return () => {
                    this.updatesSuspended = true;
                    const timeout = setTimeout(() => this.onDisconnectRule?.cancel(), 500);
                    timeout.unref();
                };
            }),
        )
    ).pipe(
        ignoreElements()
    );

    protected readonly state = this.sync.states.child(this.device.id);
    protected readonly noraSpecific = this.sync.noraSpecific.child(this.device.id);

    constructor(
        private sync: FirebaseSync,
        public readonly device: Readonly<T>,
    ) {
    }

    async updateState(update: Partial<T['state']>) {
        if (this.updatesSuspended) {
            if (this.pendingUpdates != null) {
                Object.assign(this.pendingUpdates, update);
            } else {
                this.pendingUpdates = update;
            }
        } else {
            await this.sync.updateState(this.device.id, update);
        }
    }

    async updateStateSafer<TPayload, TState = Partial<T['state']>>(
        update: TPayload,
        mapping?: { from: keyof TPayload, to: keyof TState }[]) {
        if (typeof update !== 'object') {
            return false;
        }

        const currentState = await this.state$.pipe(first()).toPromise();
        this.updateProperties(update, currentState, currentState, mapping);
        await this.updateState(currentState);
        return true;
    }

    private updateProperties(from: any, to: any, rootState: any,
        mapping?: { from: keyof any, to: keyof any }[],
        path = 'msg.payload.') {

        for (const [key, v] of Object.entries(from)) {
            let value: any = v;

            const mapTo = mapping?.find(m => m.from === key)?.to ?? key;

            const prevValue = to[mapTo];
            if (typeof prevValue !== typeof value) {
                if (typeof prevValue === 'number') {
                    value = +value;
                }

                if (typeof prevValue === 'boolean') {
                    value = !!value;
                }
            }

            if (typeof value === 'object' && typeof prevValue === 'object') {
                this.updateProperties(v, { ...prevValue }, rootState, mapping, `${path}${key}.`);
            } else {
                to[mapTo] = value;

                // if (!validate('state', rootState)) {
                //     throw new Error(`Invalid property ${path}${key} with value ${value}`);
                // }
            }
        }
    }
}
