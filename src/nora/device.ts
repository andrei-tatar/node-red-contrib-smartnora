import * as common from '@andrei-tatar/nora-firebase-common';
import { child, onValue } from 'firebase/database';
import { firstValueFrom, merge, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { Logger, singleton } from '..';
import { AsyncCommandsRegistry } from './async-commands.registry';
import { getSafeUpdate } from './safe-update';
import { FirebaseSync } from './sync';

export class FirebaseDevice<T extends common.Device = common.Device> {
    private connectedAndSynced = false;

    private readonly _state$ = new Observable<{
        state: T['state'];
        update: {
            by: 'server' | 'client';
            timestamp: number;
        };
    }>(observer => {
        const stateSubscription = onValue(this.state, s => observer.next(s.val()));
        const noraSubscription = onValue(this.noraSpecific, s => {
            if (this.connectedAndSynced) {
                // keep noraSpecific in sync as it's needed for local execution
                this.device.noraSpecific = s.val() ?? {};
            }
        });
        return () => {
            stateSubscription();
            noraSubscription();
        };
    }).pipe(
        filter(v => !!v && typeof v === 'object'),
        singleton(),
    );

    private readonly _localStateUpdate$ = new Subject<T['state']>();
    private readonly _localAsyncCommand$ = new Subject<{ id: string; command: common.AsyncCommand }>();

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
        const ref = child(this.noraSpecific, 'error');
        return onValue(ref, s => {
            const value: { msg: string; details: any } | null = s.val();
            if (value) {
                this.logger?.trace(`[nora][${this.device.id}] error syncing device: ${JSON.stringify(value?.details ?? {})}`);
            }
            observer.next(value?.msg ?? null);
        });
    });

    readonly local$ = new Subject<true>();
    readonly state = child(this.sync.states, this.device.id);
    readonly noraSpecific = child(this.sync.noraSpecific, this.device.id);
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
        mapping?: { from: keyof TPayload; to: keyof TState }[]) {
        return this.updateStateInternal(update, { mapping });
    }

    async executeCommand(command: string, params: any): Promise<T['state']> {
        this.local$.next(true);

        let updates: common.Changes | null = null;
        if (this.device.noraSpecific?.asyncCommandExecution === true ||
            Array.isArray(this.device.noraSpecific.asyncCommandExecution) &&
            this.device.noraSpecific.asyncCommandExecution.includes(command)) {
            const commandId = `${this.device.id}:${new Date().getTime()}`;
            const response = AsyncCommandsRegistry.getLocalResponse(commandId, this.device);
            this._localAsyncCommand$.next({
                id: commandId,
                command: { command, params },
            });

            const result = await firstValueFrom(response);
            if (result.errorCode) {
                throw new common.ExecuteCommandError(result.errorCode as any);
            } else {
                updates = {
                    updateState: result.state,
                    result: result.result,
                };
            }
        } else {
            updates = common.executeCommand({ command, params, device: this.device });
            this.logger?.trace(`[nora][local-execution][${this.device.id}] executed ${command}`);
        }

        if (updates?.updateState) {
            this.updateStateInternal(updates.updateState).catch(err =>
                this.logger?.warn(`error while executing local command, ${err.message}: ${err.stack}`)
            );
            this._localStateUpdate$.next(this.device.state);
            return this.device.state;
        }

        return {
            ...this.device.state,
            ...updates?.result,
        };
    }

    private async updateStateInternal<TState = Partial<T['state']>, TPayload = TState>(
        update: TPayload,
        { mapping }: {
            mapping?: { from: keyof TPayload; to: keyof TState }[];
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
            isValid: () => common.validate(this.device.traits, 'state-update', safeUpdate).valid,
            mapping,
            warn: (msg) => this?.logger?.warn(`[${this.device.name.name}] ignoring property ${msg}`),
        });

        const { hasChanges, state } = common.updateState(safeUpdate, this.device.state);
        if (hasChanges) {
            const { valid } = common.validate(this.device.traits, 'state', state);
            if (!valid) {
                const name = this.device.name.name;
                const safeStr = JSON.stringify(safeUpdate);
                const stateStr = JSON.stringify(state);
                this?.logger?.warn(`[${name}] invalid state after update. aborting update. ${safeStr} => ${stateStr}`);
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
