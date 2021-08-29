import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

import { merge, Observable, of, timer } from 'rxjs';
import { delayWhen, finalize, ignoreElements, map, retryWhen, switchMap, tap } from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay } from '..';
import { firebaseConfig, NoraConfig } from '../config';
import { AsyncCommandsRegistry } from './async-commands.registry';
import { DeviceContext } from './device-context';
import { LocalExecution } from './local-execution';
import { FirebaseSync } from './sync';

export class FirebaseConnection {
    private static logger: Logger | null;

    private static readonly configs: {
        [key: string]: Observable<FirebaseSync>;
    } = {};

    private static readonly apps: {
        [key: string]: Observable<FirebaseApp>;
    } = {};

    static withLogger(logger: Logger) {
        this.logger ??= logger;
        LocalExecution.withLogger(logger);
        AsyncCommandsRegistry.withLogger(logger);
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
                    const result = await signInWithEmailAndPassword(getAuth(app), config.email, config.password);
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
        return new Observable<FirebaseApp>(observer => {
            const app = initializeApp(firebaseConfig, `app-${new Date().getTime()}`);
            observer.next(app);
            return () => deleteApp(app);
        });
    }
}
