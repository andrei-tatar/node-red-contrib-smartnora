import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken, UserCredential } from 'firebase/auth';
import { firstValueFrom, merge, NEVER, Observable, of, timer } from 'rxjs';
import { delayWhen, finalize, ignoreElements, map, retryWhen, switchMap, tap } from 'rxjs/operators';
import fetch from 'node-fetch';

import { getHash, HttpError, Logger, publishReplayRefCountWithDelay } from '..';
import { API_ENDPOINT, FIREBASE_CONFIG, NoraConfig, USER_AGENT } from '../config';
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
        const key = getHash(`${config.email}:${config.group}`);
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

    private static getAppFromConfig(config: NoraConfig) {
        const key = getHash(`${config.email}`);
        let cached = this.apps[key];
        if (!cached) {
            cached = this.apps[key] = this.createFirebaseApp().pipe(
                switchMap(async app => {
                    const result = await this.authenticate(app, config);
                    this.logger?.info(`nora: authenticated, uid: ${result.user?.uid}`);
                    return app;
                }),
                finalize(() => delete this.apps[key]),
                publishReplayRefCountWithDelay(5000),
            );
        }
        return cached;
    }

    private static async authenticate(app: FirebaseApp, config: NoraConfig): Promise<UserCredential> {
        const auth = getAuth(app);

        if (config.password?.length) {
            return await signInWithEmailAndPassword(auth, config.email, config.password);
        } else if (config.sso?.length) {
            const customToken = await this.exchangeToken(config.sso);
            return await signInWithCustomToken(auth, customToken);
        } else {
            this.logger?.error('nora: invalid auth config; not retrying');
            return firstValueFrom(NEVER);
        }
    }

    private static async exchangeToken(ssoToken: string): Promise<string> {
        const url = `${API_ENDPOINT}/sso/exchange`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': USER_AGENT,
            },
            body: JSON.stringify({
                token: ssoToken
            }),
        });

        if (response.status === 200) {
            const { token } = await response.json();
            return token;
        }

        if (response.status === 400) {
            this.logger?.error(`nora: invalid sso token; not retrying - ${await response.text()}`);
            return firstValueFrom(NEVER);
        }

        throw new HttpError(response.status, await response.text());
    }

    private static createFirebaseApp() {
        return new Observable<FirebaseApp>(observer => {
            const app = initializeApp(FIREBASE_CONFIG, `app-${new Date().getTime()}`);
            observer.next(app);
            return () => deleteApp(app);
        });
    }
}
