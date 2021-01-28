import { Device, executeCommand, isColorSetting, validate } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { merge, Observable, Subject } from 'rxjs';
import { filter, ignoreElements, map, publish, publishReplay, refCount, tap } from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay } from '..';
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
                const prevOnline = this.device.state.online;
                this.device.state = state;
                if (!this.connectedAndSynced) {
                    this.device.state.online = prevOnline;
                }
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
        const safeUpdate = this.getSafeUpdate(update, currentState, mapping);
        if (safeUpdate) {
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
        // tslint:disable-next-line: no-console
        console.log(params, updates);
        this.logger?.log(`[nora][local-execution][${this.device.id}] executed ${command}`);

        if (updates?.updateState) {
            const currentState = {
                ...this.device.state,
                ...updates.updateState,
            };
            this.updateState(updates.updateState);
            this._localStateUpdate$.next(currentState);
            return currentState;
        }

        return this.device.state;
    }

    private getSafeUpdate(
        update: any,
        currentState: any,
        mapping?: { from: keyof any, to: keyof any }[],
        path = 'msg.payload.',
        safeUpdateObject: any = {},
        validateUpdate?: () => boolean,
        removePropertiesIfSameValue = true,
    ) {

        validateUpdate ??= () => validate(this.device.traits, 'state', safeUpdateObject).valid;

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

                // hackish way to preserve  accuracy on sat/val
                const skipRoundingNumbers = isColorSetting(this.device) && path.indexOf('color') >= 0;

                if (!skipRoundingNumbers) {
                    updateValue = Math.round(updateValue * 10) / 10;
                }
            }

            if (typeof updateValue === 'object' && typeof previousValue === 'object') {
                const partial = {};
                safeUpdateObject[updateKey] = updateValue; // set it for validation
                updateValue = this.getSafeUpdate(updateValue, previousValue, mapping, `${path}${key}.`, partial, validateUpdate, false);
                delete safeUpdateObject[updateKey];
            } else {
                if (removePropertiesIfSameValue && updateValue === previousValue) {
                    updateValue = undefined;
                }
            }

            if (updateValue !== undefined) {
                safeUpdateObject[updateKey] = updateValue;
                if (!validateUpdate()) {
                    delete safeUpdateObject[updateKey];
                    this.logger?.warn(`[${this.device.id}] ignoring property for update ${path}${key} - invalid for ${this.device.type}`);
                }
            }
        }

        return Object.keys(safeUpdateObject).length ? safeUpdateObject : undefined;
    }
}
