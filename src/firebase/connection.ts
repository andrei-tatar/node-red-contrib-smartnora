import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

import { Observable, Subject } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';
import { NodeInterface, publishReplayRefCountWithDelay } from '..';
import { firebaseConfig, NoraConfig } from '../config';
import { FirebaseSync } from './sync';

export class FirebaseConnection {
    private static readonly configs: {
        [key: string]: Observable<FirebaseSync>;
    } = {};

    static fromConfig(config: NoraConfig, updateState: Subject<string>, node: NodeInterface) {
        const key = this.getConfigKey(config);
        let cached = this.configs[key];
        if (!cached) {
            cached = this.configs[key] = this.createFromConfig(config)
                .pipe(
                    finalize(() => delete this.configs[key]),
                    publishReplayRefCountWithDelay(5000),
                );
        }
        return cached;
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
            map(app => new FirebaseSync(app, config.group)),
        );
    }
}
