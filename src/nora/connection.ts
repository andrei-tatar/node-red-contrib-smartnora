import { createHash } from 'crypto';
import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken, UserCredential } from 'firebase/auth';
import { merge, Observable, of, timer } from 'rxjs';
import { delayWhen, finalize, ignoreElements, map, retryWhen, switchMap, tap } from 'rxjs/operators';
import fetch from 'node-fetch';

import { HttpError, Logger, publishReplayRefCountWithDelay, shouldRetryRequest } from '..';
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
        const key = this.getHash(`${config.email}:${config.group}`);
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
        const key = this.getHash(`${config.email}`);
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

    private static getHash(input: string): string {
        return createHash('md5').update(input).digest('base64');
    }

    private static async authenticate(app: FirebaseApp, config: NoraConfig): Promise<UserCredential> {
        const auth = getAuth(app);

        try {
            if (config.password?.length) {
                return await signInWithEmailAndPassword(auth, config.email, config.password);
            } else if (config.sso?.length) {
                const customToken = await this.exchangeToken(config.sso);
                return await signInWithCustomToken(auth, customToken);
            } else {
                throw new Error('nora: invalid auth config');
            }
        } catch (err) {
            this.logger?.error(`nora: ${err}`);
            await new Promise<never>(() => {
                // never resolve, there's nothing to retry
            });
            throw new Error(); // make TS happy :)
        }
    }

    private static async exchangeToken(ssoToken: string, tries = 3): Promise<string> {
        while (tries--) {
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
            if (response.status !== 200) {
                const shouldRetry = shouldRetryRequest(response);
                if (!shouldRetry || !tries) {
                    throw new HttpError(response.status, await response.text());
                }
                const delay = Math.round(Math.random() * 20) * 50 + 300;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            const json = await response.json();
            return json.token;
        }

        throw new Error('could not exchange sso token');
    }

    private static createFirebaseApp() {
        return new Observable<FirebaseApp>(observer => {
            const app = initializeApp(FIREBASE_CONFIG, `app-${new Date().getTime()}`);
            observer.next(app);
            return () => deleteApp(app);
        });
    }
}
