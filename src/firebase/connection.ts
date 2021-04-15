import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

import { combineLatest, EMPTY, merge, Observable, of, timer } from 'rxjs';
import { delayWhen, finalize, ignoreElements, map, retryWhen, startWith, switchMap, tap } from 'rxjs/operators';
import { Logger, NodeInterface, publishReplayRefCountWithDelay } from '..';
import { firebaseConfig, NoraConfig } from '../config';
import { LocalExecution } from '../local-execution/local-execution';
import { FirebaseSync } from './sync';

export class FirebaseConnection {
    private static logger: Logger | null;

    private static readonly configs: {
        [key: string]: Observable<FirebaseSync>;
    } = {};

    private static readonly apps: {
        [key: string]: Observable<firebase.app.App>;
    } = {};

    static withLogger(logger: Logger) {
        this.logger ??= logger;
        LocalExecution.withLogger(logger);
        return this;
    }

    static fromConfig(
        config: NoraConfig,
        node: NodeInterface,
        state$: Observable<string> = EMPTY,
        error$: Observable<string | null> = EMPTY) {
        const key = this.getConfigKey(config);
        let cached = this.configs[key];
        if (!cached) {
            cached = this.configs[key] = this.getAppFromConfig(config)
                .pipe(
                    map(app => new FirebaseSync(app, config.group, this.logger)),
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
                this.updateState(connection, node, state$, error$),
                of(connection),
            )),
        );
    }

    private static updateState(
        connection: FirebaseSync,
        node: NodeInterface,
        state$: Observable<string>,
        error$: Observable<string | null> = EMPTY) {
        return combineLatest([
            connection.connected$,
            state$.pipe(startWith(null)),
            error$.pipe(startWith(null)),
        ]).pipe(
            tap(([connected, state, error]) => {
                node.status(connected
                    ? (error
                        ? { fill: 'yellow', shape: 'ring', text: error }
                        : { fill: 'green', shape: 'dot', text: `${state || 'connected'}` })
                    : { fill: 'red', shape: 'ring', text: 'disconnected' });
            }),
            ignoreElements(),
        );
    }

    private static getConfigKey(config: NoraConfig) {
        return `${config.email}:${config.group}:${config.password}`;
    }

    private static getAppFromConfig(config: NoraConfig) {
        const key = `${config.email}:${config.password}`;
        let cached = this.apps[key];
        if (!cached) {
            cached = this.apps[key] = timer(5000).pipe(
                switchMap(_ => this.createFirebaseApp()),
                switchMap(async app => {
                    await firebase.auth(app)
                        .signInWithEmailAndPassword(config.email, config.password);
                    return app;
                }),
                finalize(() => delete this.apps[key]),
                publishReplayRefCountWithDelay(5000),
            );
        }
        return cached;
    }

    private static createFirebaseApp() {
        return new Observable<firebase.app.App>(observer => {
            const app = firebase.initializeApp(firebaseConfig, `app-${new Date().getTime()}`);
            observer.next(app);
            return () => app.delete();
        });
    }
}
