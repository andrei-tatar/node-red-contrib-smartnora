import { Device, executeCommand, updateState, validate } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { merge, Observable, Subject } from 'rxjs';
import { filter, map, publish, publishReplay, refCount, tap } from 'rxjs/operators';
import { Logger } from '..';
import { getSafeUpdate } from './safe-update';
import { FirebaseSync } from './sync';

export class FirebaseDevice<T extends Device = Device> {
    private connectedAndSynced = false;

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
                this.device.noraSpecific = snapshot.val() ?? {};
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
            tap(state => this.device.state = { ...state }),
        ),
        this._localStateUpdate$,
    );

    connectedAndSynced$ = new Observable<never>(_ => {
        this.connectedAndSynced = true;
        return () => this.connectedAndSynced = false;
    }).pipe(
        publish(),
        refCount(),
    );

    error$ = new Observable<string | null>(observer => {
        const handler = (snapshot: firebase.database.DataSnapshot) => {
            const value: string | null = snapshot.val();
            observer.next(value ?? null);
        };
        const ref = this.noraSpecific.child('error/msg');
        ref.on('value', handler);
        return () => ref.off('value', handler);
    });

    local$ = new Subject<true>();

    protected readonly state = this.sync.states.child(this.device.id);
    protected readonly noraSpecific = this.sync.noraSpecific.child(this.device.id);

    constructor(
        readonly cloudId: string,
        private sync: FirebaseSync,
        public readonly device: T,
        private logger: Logger | null,
    ) {
    }

    updateState<TState = Partial<T['state']>, TPayload = TState>(
        update: TPayload,
        mapping?: { from: keyof TPayload, to: keyof TState }[]) {
        return this.updateStateInternal(update, { mapping });
    }

    executeCommand(command: string, params: any): T['state'] {
        this.local$.next(true);
        const updates = executeCommand({ command, params, device: this.device });
        this.logger?.trace(`[nora][local-execution][${this.device.id}] executed ${command}`);

        if (updates?.updateState) {
            this.updateStateInternal(updates.updateState, { fromLocalExecution: true }).catch(err =>
                this.logger?.warn(`error while executing local command, ${err.message}: ${err.stack}`)
            );
            this._localStateUpdate$.next(this.device.state);
            return this.device.state;
        }

        return this.device.state;
    }

    private async updateStateInternal<TState = Partial<T['state']>, TPayload = TState>(
        update: TPayload,
        { mapping, fromLocalExecution = false }: {
            mapping?: { from: keyof TPayload, to: keyof TState }[],
            fromLocalExecution?: boolean,
        }) {

        if (typeof update !== 'object') {
            return false;
        }

        const currentState = this.device.state;
        const safeUpdate = {};
        getSafeUpdate({
            update,
            currentState,
            safeUpdateObject: safeUpdate,
            isValid: () => validate(this.device.traits, 'state-update', safeUpdate).valid,
            mapping,
            warn: (msg) => this?.logger?.warn(`[${this.device.name.name}] ignoring property ${msg}`),
        });

        const { hasChanges, state } = updateState(safeUpdate, this.device.state);
        if (hasChanges) {
            const { valid } = validate(this.device.traits, 'state', state);
            if (!valid) {
                this?.logger?.warn(`[${this.device.name.name}] invalid state after update. aborting update. ${JSON.stringify(safeUpdate)} => ${JSON.stringify(state)}`);
                return;
            }

            this.device.state = state;
            if (this.connectedAndSynced) {
                await this.sync.updateState(this.device.id, safeUpdate, fromLocalExecution);
            }
        }

        return true;
    }
}
