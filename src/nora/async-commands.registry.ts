import { AsyncCommand, AsyncResponse } from '@andrei-tatar/nora-firebase-common';
import { catchError, EMPTY, first, ignoreElements, merge, mergeMap, Observable, Observer, of, race, Subject, switchMap, timeout } from 'rxjs';
import { Logger } from '..';

export class AsyncCommandsRegistry {
    private static readonly handlers = new Map<string, Observer<AsyncResponse>>();
    private static logger: Logger | null;

    static handle(id: string, response: AsyncResponse) {
        this.logger?.trace(`[async-cmd] got response for ${id}`);
        const observer = this.handlers.get(id);
        observer?.next(response);
    }

    static withLogger(logger: Logger) {
        this.logger ??= logger;
        return this;
    }

    static getCloudAsyncCommandHandler(noraSpecific: firebase.default.database.Reference) {
        const asyncCommands = noraSpecific.child('commands');
        const asyncResponses = noraSpecific.child('responses');
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
                const response = new Subject<AsyncResponse>();
                const writeResponse$ = response.pipe(
                    first(),
                    switchMap(d => asyncResponses.child(cmd.id).set(d)),
                    timeout(1000),
                    catchError(_ => {
                        this.logger?.warn(`[async-cmd] timeout waiting for response`);
                        return EMPTY;
                    }),
                    ignoreElements(),
                );

                const registerHandler$ = new Observable<never>(_ => {
                    this.handlers.set(cmd.id, response);
                    return () => this.handlers.delete(cmd.id);
                });

                return merge(race(writeResponse$, registerHandler$), of(cmd));
            }),
        );
    }
}
