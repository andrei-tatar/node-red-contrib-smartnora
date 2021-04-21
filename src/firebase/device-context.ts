import { combineLatest, Observable, Subject } from 'rxjs';
import { ignoreElements, startWith, takeUntil, tap } from 'rxjs/operators';
import { NodeInterface } from '..';

export class DeviceContext {
    public readonly error$ = new Subject<string | null>();
    public readonly state$ = new Subject<string>();
    public readonly local$ = new Subject<true>();
    public readonly connected$ = new Subject<boolean>();

    constructor(
        private node: NodeInterface,
    ) {
    }

    update(stop$: Observable<any>) {
        combineLatest([
            this.connected$,
            this.state$.pipe(startWith(null)),
            this.error$.pipe(startWith(null)),
            this.local$.pipe(startWith(false)),
        ]).pipe(
            tap(([connected, state, error, local]) => {
                this.node.status(connected
                    ? (error
                        ? { fill: 'yellow', shape: 'ring', text: error }
                        : { fill: local ? 'blue' : 'green', shape: 'dot', text: `${state || 'connected'}` })
                    : { fill: 'red', shape: 'ring', text: 'disconnected' });
            }),
            ignoreElements(),
            takeUntil(stop$),
        ).subscribe();
    }
}
