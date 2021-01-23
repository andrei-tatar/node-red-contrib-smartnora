import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

import { combineLatest, EMPTY, merge, Observable, of, timer } from 'rxjs';
import { delayWhen, finalize, ignoreElements, map, retryWhen, startWith, switchMap, tap } from 'rxjs/operators';
import { Logger, NodeInterface, publishReplayRefCountWithDelay } from '..';
import { firebaseConfig, NoraConfig } from '../config';
import { FirebaseSync } from './sync';

export class FirebaseConnection {
    private static logger: Logger | null;

    private static readonly configs: {
        [key: string]: Observable<FirebaseSync>;
    } = {};

    static withLogger(logger: Logger) {
        this.logger ??= logger;
        return this;
    }

    static fromConfig(config: NoraConfig, node: NodeInterface, state$: Observable<string> = EMPTY) {
        const key = this.getConfigKey(config);
        let cached = this.configs[key];
        if (!cached) {
            cached = this.configs[key] = this.createFromConfig(config)
                .pipe(
                    finalize(() => delete this.configs[key]),
                    retryWhen(err$ => err$.pipe(
                        delayWhen(err => {
                            node.status({ fill: 'red', shape: 'ring', text: 'error connecting' });
                            const seconds = Math.round(Math.random() * 120) / 2 + 30;
                            this.logger?.error(`nora: ${err}`);
                            this.logger?.warn(`nora: trying again in ${seconds} sec`);
                            return timer(seconds * 1000);
                        })
                    )),
                    publishReplayRefCountWithDelay(5000),
                );
        }

        return cached.pipe(
            switchMap(connection => merge(
                this.updateState(connection, node, state$),
                of(connection),
            )),
        );
    }

    private static updateState(connection: FirebaseSync, node: NodeInterface, state$: Observable<string>) {
        return combineLatest([connection.connected$, state$.pipe(startWith(null))])
            .pipe(
                tap(([connected, state]) => {
                    node.status(connected
                        ? { fill: 'green', shape: 'dot', text: `${state || 'connected'}` }
                        : { fill: 'red', shape: 'ring', text: 'disconnected' });
                }),
                ignoreElements(),
            );
    }

    private static getConfigKey(config: NoraConfig) {
        return `${config.email}:${config.group}:${config.password}`;
    }

    private static createFromConfig(config: NoraConfig) {
        return new Observable<firebase.app.App>(observer => {
            const app = firebase.initializeApp(firebaseConfig);
            observer.next(app);
            return () => app.delete();
        }).pipe(
            switchMap(async app => {
                await firebase.auth(app)
                    .signInWithEmailAndPassword(config.email, config.password);
                return app;
            }),
            map(app => new FirebaseSync(app, config.group, this.logger)),
        );
    }
}
