import { combineLatest, Observable, Subject } from 'rxjs';
import { debounceTime, ignoreElements, startWith, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';

export class DeviceContext {
    public readonly error$ = new Subject<string | null>();
    public readonly status$ = new Subject<string | null>();
    public readonly local$ = new Subject<boolean>();
    public readonly connected$ = new Subject<boolean>();
    public readonly online$ = new Subject<boolean>();

    constructor(
        private node: NodeInterface,
    ) {
    }

    startUpdating(stop$: Observable<any>) {
        combineLatest([
            this.connected$.pipe(startWith(false)),
            this.status$.pipe(startWith(null)),
            this.error$.pipe(startWith(null)),
            this.local$.pipe(startWith(false)),
            this.online$.pipe(startWith(true)),
        ]).pipe(
            debounceTime(0),
            tap(([connected, state, error, local, online]) => {
                this.node.status(connected
                    ? (online ?
                        (error
                            ? { fill: 'yellow', shape: 'ring', text: error }
                            : { fill: local ? 'blue' : 'green', shape: 'dot', text: `${state || 'connected'}` })
                        : { fill: 'red', shape: 'ring', text: 'offline' })
                    : { fill: 'red', shape: 'ring', text: 'disconnected' });
            }),
            ignoreElements(),
            takeUntil(stop$),
        ).subscribe();
    }
}
