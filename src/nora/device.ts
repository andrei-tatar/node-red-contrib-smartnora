import {
    Device, AsyncCommand, Changes, ExecuteCommandError,
    executeCommand, validate, updateState
} from '@andrei-tatar/nora-firebase-common';
import { ObjectDetectionNotification } from '@andrei-tatar/nora-firebase-common';
import { child, onValue } from 'firebase/database';
import { concat, defer, firstValueFrom, merge, NEVER, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, finalize, map, tap } from 'rxjs/operators';
import { cloneDeep, getHash, Logger, singleton } from '..';
import { AsyncCommandsRegistry } from './async-commands.registry';
import { getSafeUpdate } from './safe-update';
import { FirebaseSync } from './sync';

export class FirebaseDevice<T extends Device = Device> {
    private static updatedStates = new Map<string, string>();

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
    private readonly _localAsyncCommand$ = new Subject<{ id: string; command: AsyncCommand }>();

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

    readonly connectedAndSynced$ = defer(() => {
        this.connectedAndSynced = true;
        return concat(this.syncStateIfChanged(), NEVER);
    }).pipe(
        finalize(() => this.connectedAndSynced = false),
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
        private disableValidationErrors: boolean,
    ) {
    }

    updateState<TState = Partial<T['state']>, TPayload = TState>(
        update: TPayload,
        mapping?: { from: keyof TPayload; to: keyof TState }[]) {
        return this.updateStateInternal(update, { mapping });
    }

    async sendNotification(notification: ObjectDetectionNotification) {
        await this.sync.sendGoogleHomeNotification(this.device.id, notification);
    }

    async executeCommand(command: string, params: any): Promise<T['state']> {
        this.local$.next(true);

        let updates: Changes | null = null;
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
                throw new ExecuteCommandError(result.errorCode as any);
            } else {
                updates = {
                    updateState: result.state,
                    result: result.result,
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
            isValid: () => validate(this.device.traits, 'state-update', safeUpdate).valid,
            mapping,
            warn: (msg) => !this.disableValidationErrors && this?.logger?.warn(`[${this.device.name.name}] ignoring property ${msg}`),
        });

        const { hasChanges, state } = updateState(safeUpdate, this.device.state);
        if (hasChanges) {
            const { valid } = validate(this.device.traits, 'state', state);
            if (!valid) {
                const name = this.device.name.name;
                const safeStr = JSON.stringify(safeUpdate);
                const stateStr = JSON.stringify(state);
                this?.logger?.warn(`[${name}] invalid state after update. aborting update. ${safeStr} => ${stateStr}`);
                return;
            }

            this.device.state = state;
        }

        if (this.connectedAndSynced) {
            await this.syncStateIfChanged();
        }

        return true;
    }

    private async syncStateIfChanged() {
        const state = cloneDeep(this.device.state);
        const lastUpdateHash = FirebaseDevice.updatedStates.get(this.device.id);
        const currentHash = getHash(state);

        if (!lastUpdateHash || lastUpdateHash !== currentHash) {
            await this.sync.updateState(this.device.id, state);
            FirebaseDevice.updatedStates.set(this.device.id, currentHash);
        }
    }
}
