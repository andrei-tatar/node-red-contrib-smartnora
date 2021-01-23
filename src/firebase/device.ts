import { Device } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { concat, defer, merge, NEVER, Observable, of } from 'rxjs';
import { filter, finalize, first, ignoreElements, map, publish, publishReplay, refCount, switchMap } from 'rxjs/operators';
import { publishReplayRefCountWithDelay } from '..';
import { FirebaseSync } from './sync';

export class FirebaseDevice<T extends Device = Device> {
    private pendingUpdates: object | null = null;
    private updatesSuspended = true;

    private disconnectRule$ = new Observable(observer => {
        const rule = this.state.child('state/online').onDisconnect();
        rule.set(false);
        observer.next(rule);
        return () => rule.cancel();
    }).pipe(
        publishReplayRefCountWithDelay(500),
    );

    private readonly _state$ = new Observable<{
        state: T['state'],
        update: {
            by: 'server' | 'client',
            timestamp: number,
        }
    }>(observer => {
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

    readonly state$ = this._state$.pipe(
        map(({ state }) => state),
    );

    readonly stateUpdates$ = this._state$.pipe(
        filter(({ update }) => update.by !== 'client' && new Date().getTime() - update.timestamp < 10000),
        map(({ state }) => state),
    );

    updates$ = concat(
        merge(
            this.disconnectRule$,
            defer(async () => {
                let pendingUpdates = this.pendingUpdates;
                while (pendingUpdates != null) {
                    this.pendingUpdates = null;
                    await this.sync.updateState(this.device.id, pendingUpdates);
                    pendingUpdates = this.pendingUpdates;
                }
                this.updatesSuspended = false;
            }),
        )
    ).pipe(
        finalize(() => this.updatesSuspended = true),
        ignoreElements(),
        publish(),
        refCount(),
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
