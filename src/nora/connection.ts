import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

import { merge, Observable, of, timer } from 'rxjs';
import { delayWhen, finalize, ignoreElements, map, retryWhen, switchMap, tap } from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay } from '..';
import { firebaseConfig, NoraConfig } from '../config';
import { DeviceContext } from './device-context';
import { LocalExecution } from './local-execution';
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
        ctx: DeviceContext) {
        const key = this.getConfigKey(config);
        let cached = this.configs[key];
        if (!cached) {
            cached = this.configs[key] = this.getAppFromConfig(config)
                .pipe(
                    map(app => new FirebaseSync(app, config.group, this.logger)),
                    finalize(() => delete this.configs[key]),
                    retryWhen(err$ => err$.pipe(
                        delayWhen(err => {
                            const seconds = Math.round(Math.random() * 120) / 2 + 30;
                            this.logger?.error(`nora: ${err}`);
                            this.logger?.warn(`nora: trying again in ${seconds} sec`);
                            return timer(seconds * 1000);
                        }),
                    )),
                    publishReplayRefCountWithDelay(5000),
                );
        }

        return cached.pipe(
            switchMap(connection => merge(
                connection.connected$.pipe(tap(ctx.connected$), ignoreElements()),
                of(connection),
            )),
        );
    }

    private static getConfigKey(config: NoraConfig) {
        return `${config.email}:${config.group}:${config.password}`;
    }

    private static getAppFromConfig(config: NoraConfig) {
        const key = `${config.email}:${config.password}`;
        let cached = this.apps[key];
        if (!cached) {
            cached = this.apps[key] = this.createFirebaseApp().pipe(
                switchMap(async app => {
                    const result = await firebase.auth(app)
                        .signInWithEmailAndPassword(config.email, config.password);
                    this.logger?.info(`nora: authenticated, uid: ${result.user?.uid}`);
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
