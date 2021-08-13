import { AsyncCommand, AsyncResponse, ASYNC_CMD_TIMEOUT_ERRORCODE, ASYNC_CMD_TIMEOUT_MILLISECONDS, Device, validate } from '@andrei-tatar/nora-firebase-common';
import { Schema } from '@andrei-tatar/nora-firebase-common/build/schema';
import { catchError, EMPTY, first, ignoreElements, merge, mergeMap, Observable, Observer, of, race, Subject, switchMap, timeout } from 'rxjs';
import { Logger } from '..';
import { FirebaseDevice } from './device';
import { getSafeUpdate } from './safe-update';

export class AsyncCommandsRegistry {
    private static readonly handlers = new Map<string, {
        observer: Observer<AsyncResponse>;
        device: Device;
    }>();
    private static logger: Logger | null;

    static handle(id: string, d: AsyncResponse): void {
        this.logger?.trace(`[async-cmd] got response for ${id}`);
        const handler = this.handlers.get(id);
        if (!handler) {
            // TODO: log?
            return;
        }

        const response: AsyncResponse = {};
        if ('errorCode' in d && typeof d.errorCode === 'string') {
            if (!Schema.device.armdisarm.definitions.ErrorCode.enum.includes(d.errorCode)) {
                this.logger?.warn(`[async-cmd] invalid error code ${d.errorCode}`);
                return;
            }
            response.errorCode = d.errorCode;
        } else if ('state' in d && typeof d.state === 'object') {
            const safeUpdate = {};
            getSafeUpdate({
                path: 'msg.payload.state.',
                currentState: handler.device.state,
                safeUpdateObject: safeUpdate,
                isValid: () => validate(handler.device.traits, 'state-update', safeUpdate).valid,
                update: d.state,
                warn: prop => this.logger?.warn(`[async-cmd] ignoring state prop ${prop}`),
            });
            response.state = safeUpdate;
        }

        if (Object.keys(response).length === 0) {
            (response as any).timestamp = new Date().getTime();
        }

        handler.observer.next(response);
    }

    static withLogger(logger: Logger) {
        this.logger ??= logger;
        return this;
    }

    static getLocalResponse(id: string, device: Device): Observable<AsyncResponse> {
        return new Observable<AsyncResponse>(observer => {
            this.handlers.set(id, { observer, device });
            return () => this.handlers.delete(id);
        }).pipe(
            first(),
            timeout(ASYNC_CMD_TIMEOUT_MILLISECONDS),
            catchError(_ => of<AsyncResponse>({
                errorCode: ASYNC_CMD_TIMEOUT_ERRORCODE,
            })),
        );
    }

    static getCloudAsyncCommandHandler<T extends Device>(device: FirebaseDevice<T>) {
        const asyncCommands = device.noraSpecific.child('commands');
        const asyncResponses = device.noraSpecific.child('responses');
        return new Observable<{ id: string, command: AsyncCommand }>(observer => {
            const handler = asyncCommands.on('child_added', d => {
                this.logger?.trace(`[async-cmd] async command received ${d.key}`);
                if (d.key) {
                    observer.next({
                        id: d.key,
                        command: d.val(),
                    });
                }
            });
            return () => asyncCommands.off('child_added', handler);
        }).pipe(
            mergeMap(cmd => {
                const handler = new Subject<AsyncResponse>();
                const writeResponse$ = handler.pipe(
                    first(),
                    switchMap(response => asyncResponses.child(cmd.id).set(response)),
                    timeout(1000),
                    catchError(_ => {
                        this.logger?.warn(`[async-cmd] timeout waiting for response`);
                        return EMPTY;
                    }),
                    ignoreElements(),
                );

                const registerHandler$ = new Observable<never>(_ => {
                    this.handlers.set(cmd.id, { observer: handler, device: device.device });
                    return () => this.handlers.delete(cmd.id);
                });

                return merge(race(writeResponse$, registerHandler$), of(cmd));
            }),
        );
    }
}
