import { AsyncCommand, Changes, Device, executeCommand, ExecuteCommandError, updateState, validate } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { firstValueFrom, merge, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { Logger, singleton } from '..';
import { AsyncCommandsRegistry } from './async-commands.registry';
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
        const handler = this.state.on('value', snapshot => observer.next(snapshot.val()));
        const noraHandler = this.noraSpecific.on('value', snapshot => {
            if (this.connectedAndSynced) {
                // keep noraSpecific in sync as it's needed for local execution
                this.device.noraSpecific = snapshot.val() ?? {};
            }
        });
        return () => {
            this.state.off('value', handler);
            this.noraSpecific.off('value', noraHandler);
        };
    }).pipe(
        filter(v => !!v && typeof v === 'object'),
        singleton(),
    );

    private readonly _localStateUpdate$ = new Subject<T['state']>();
    private readonly _localAsyncCommand$ = new Subject<{ id: string, command: AsyncCommand }>();

    readonly state$ = this._state$.pipe(
        map(({ state }) => state),
    );

    readonly stateUpdates$ = merge(
        this._state$.pipe(
            filter(({ update }) => update.by !== 'client' && this.connectedAndSynced),
            distinctUntilChanged((a, b) => a.update.timestamp === b.update.timestamp),
            map(({ state }) => state),
            tap(state => this.device.state = { ...state }),
        ),
        this._localStateUpdate$,
    );

    readonly connectedAndSynced$ = new Observable<never>(_ => {
        this.connectedAndSynced = true;
        return () => this.connectedAndSynced = false;
    }).pipe(
        singleton(),
    );

    readonly error$ = new Observable<string | null>(observer => {
        const ref = this.noraSpecific.child('error/msg');
        const handler = ref.on('value', (snapshot: firebase.database.DataSnapshot) => {
            const value: string | null = snapshot.val();
            observer.next(value ?? null);
        });
        return () => ref.off('value', handler);
    });

    readonly local$ = new Subject<true>();
    readonly state = this.sync.states.child(this.device.id);
    readonly noraSpecific = this.sync.noraSpecific.child(this.device.id);
    readonly asyncCommands$ = merge(
        this._localAsyncCommand$,
        AsyncCommandsRegistry.getCloudAsyncCommandHandler(this),
    );

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

    async executeCommand(command: string, params: any): Promise<T['state']> {
        this.local$.next(true);

        let updates: Changes | null = null;
        if (this.device.noraSpecific?.asyncCommandExecution) {
            const commandId = `${this.device.id}:${new Date().getTime()}`;
            const response = AsyncCommandsRegistry.getLocalResponse(commandId, this.device);
            this._localAsyncCommand$.next({
                id: commandId,
                command: { command, params },
            });

            const result = await firstValueFrom(response);
            if (result.errorCode) {
                throw new ExecuteCommandError(result.errorCode as any);
            } else if (result.state) {
                updates = {
                    updateState: result.state,
                };
            }
        } else {
            updates = executeCommand({ command, params, device: this.device });
            this.logger?.trace(`[nora][local-execution][${this.device.id}] executed ${command}`);
        }

        if (updates?.updateState) {
            this.updateStateInternal(updates.updateState).catch(err =>
                this.logger?.warn(`error while executing local command, ${err.message}: ${err.stack}`)
            );
            this._localStateUpdate$.next(this.device.state);
            return this.device.state;
        }

        return this.device.state;
    }

    private async updateStateInternal<TState = Partial<T['state']>, TPayload = TState>(
        update: TPayload,
        { mapping }: {
            mapping?: { from: keyof TPayload, to: keyof TState }[],
        } = {}) {

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
                await this.sync.updateState(this.device.id, safeUpdate);
            }
        }

        return true;
    }
}
