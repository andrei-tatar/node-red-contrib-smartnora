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

    static handle({ id, response: rsp, warn }: { id: string, response: AsyncResponse, warn: (msg: string) => void }): void {
        this.logger?.trace(`[async-cmd] got response for ${id}`);
        const handler = this.handlers.get(id);
        if (!handler) {
            warn('No handled registered for command');
            return;
        }

        const response: AsyncResponse = {};
        if ('errorCode' in rsp && typeof rsp.errorCode === 'string') {
            if (!Schema.device.statusreport.definitions.ErrorCode.enum.includes(rsp.errorCode as any)) {
                warn(`Invalid error code: ${rsp.errorCode}`);
                return;
            }
            response.errorCode = rsp.errorCode;
        } else if ('state' in rsp && typeof rsp.state === 'object') {
            const safeUpdate = {};
            getSafeUpdate({
                update: rsp.state,
                currentState: handler.device.state,
                safeUpdateObject: safeUpdate,
                path: 'msg.payload.state.',
                isValid: () => validate(handler.device.traits, 'state-update', safeUpdate).valid,
                warn: prop => warn(`Ignoring prop ${prop}`),
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
