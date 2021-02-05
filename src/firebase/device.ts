import { Device, executeCommand, updateHasChanges, validate } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { merge, Observable, Subject } from 'rxjs';
import { filter, ignoreElements, map, publish, publishReplay, refCount, tap } from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay } from '..';
import { getSafeUpdate } from './safe-update';
import { FirebaseSync } from './sync';

export class FirebaseDevice<T extends Device = Device> {
    private connectedAndSynced = false;
    private disconnectRule$ = new Observable(observer => {
        const rule = this.state.child('state/online').onDisconnect();
        rule.set(false);
        observer.next(rule);
        this.connectedAndSynced = true;
        return () => {
            this.connectedAndSynced = false;
            rule.cancel();
        };
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
        const handler = (snapshot: firebase.database.DataSnapshot) => observer.next(snapshot.val());
        const noraHandler = (snapshot: firebase.database.DataSnapshot) => {
            if (this.connectedAndSynced) {
                // keep noraSpecific in sync as it's needed for local execution
                this.device.noraSpecific = snapshot.val();
            }
        };
        this.state.on('value', handler);
        this.noraSpecific.on('value', noraHandler);
        return () => {
            this.state.off('value', handler);
            this.noraSpecific.off('value', noraHandler);
        };
    }).pipe(
        filter(v => !!v && typeof v === 'object'),
        publishReplay(1),
        refCount(),
    );

    private readonly _localStateUpdate$ = new Subject<T['state']>();

    readonly state$ = this._state$.pipe(
        map(({ state }) => state),
    );

    readonly stateUpdates$ = merge(
        this._state$.pipe(
            filter(({ update }) => update.by !== 'client' && this.connectedAndSynced),
            map(({ state }) => state),
            tap(state => {
                this.device.state = {
                    ...state,
                    online: this.device.state.online,
                };
            }),
        ),
        this._localStateUpdate$,
    );

    connectedAndSynced$ = this.disconnectRule$.pipe(
        ignoreElements(),
        publish(),
        refCount(),
    );

    protected readonly state = this.sync.states.child(this.device.id);
    protected readonly noraSpecific = this.sync.noraSpecific.child(this.device.id);

    constructor(
        readonly cloudId: string,
        private sync: FirebaseSync,
        public readonly device: T,
        private logger: Logger | null,
    ) {
    }

    async updateState<TState = Partial<T['state']>, TPayload = TState>(
        update: TPayload,
        mapping?: { from: keyof TPayload, to: keyof TState }[]) {

        if (typeof update !== 'object') {
            return false;
        }

        const currentState = this.device.state;
        const safeUpdate = {};
        getSafeUpdate({
            update,
            currentState,
            safeUpdateObject: safeUpdate,
            isValid: () => validate(this.device.traits, 'state', safeUpdate).valid,
            mapping,
            warn: (msg) => this?.logger?.warn(`[${this.device.name.name}] ignoring property ${msg}`),
        });
        if (safeUpdate && updateHasChanges(safeUpdate, this.device.state)) {
            this.device.state = {
                ...this.device.state,
                ...safeUpdate,
            };
            if (!this.connectedAndSynced) {
                throw new Error('device not connected/synced');
            }
            await this.sync.updateState(this.device.id, safeUpdate);
        }
        return true;
    }

    executeCommand(command: string, params: any) {
        const updates = executeCommand({ command, params, device: this.device });
        this.logger?.log(`[nora][local-execution][${this.device.id}] executed ${command}`);

        if (updates?.updateState) {
            const currentState = {
                ...this.device.state,
                ...updates.updateState,
            };
            this.updateState(updates.updateState).catch(err => {
                this.logger?.warn(`error while executing local command, ${err.message}: ${err.stack}`)
            });
            this._localStateUpdate$.next(currentState);
            return currentState;
        }

        return this.device.state;
    }
}
