import { Device, isScene, SceneDevice } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { Agent } from 'https';
import fetch from 'node-fetch';
import { BehaviorSubject, concat, EMPTY, merge, Observable, of, Subject } from 'rxjs';
import {
    catchError,
    debounceTime, distinctUntilChanged, ignoreElements,
    mergeMap,
    publish, publishReplay, refCount, switchMap,
} from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay } from '..';
import { functionsEndpoint } from '../config';
import { FirebaseDevice } from './device';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
    private agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 15000,
    });

    private devices$ = new BehaviorSubject<FirebaseDevice[]>([]);
    private jobQueue$ = new Subject<Job>();

    private sync$ = this.devices$.pipe(
        debounceTime(1000),
        switchMap(devices =>
            concat(
                this.syncDevices(devices),
                merge(...devices.map(d => d.connectedAndSynced$)),
            ),
        ),
        ignoreElements(),
        publish(),
        refCount(),
        catchError(err => {
            this.logger?.warn(`unhandled error: ${err.message}\n${err.stack}`);
            return EMPTY;
        }),
    );

    private handleJobs$ = this.jobQueue$.pipe(
        mergeMap(job => this.handleJob(job), 1),
        ignoreElements(),
        publishReplayRefCountWithDelay(1000),
    );

    readonly connected$ = new Observable<boolean>(observer => {
        const handler = (s: firebase.database.DataSnapshot) => observer.next(s.val());
        this.connected.on('value', handler);
        return () => this.connected.off('value', handler);
    }).pipe(
        switchMap(connected => connected
            ? merge(this.handleJobs$, this.sync$, of(connected))
            : of(connected)
        ),
        distinctUntilChanged(),
        publishReplay(1),
        refCount(),
    );

    readonly uid: string | undefined;
    readonly states: firebase.database.Reference;
    readonly noraSpecific: firebase.database.Reference;
    private readonly connected: firebase.database.Reference;

    constructor(
        private app: firebase.app.App,
        private readonly group: string = '<default>',
        private logger: Logger | null,
    ) {
        this.uid = this.app.auth().currentUser?.uid;
        const db = firebase.database(app);
        this.states = db.ref(`device_states/${this.uid}/${this.group}`);
        this.noraSpecific = db.ref(`device_nora/${this.uid}/${this.group}`);
        this.connected = db.ref('.info/connected');
    }

    withDevice<T extends SceneDevice>(device: T): Observable<FirebaseSceneDevice<T>>;
    withDevice<T extends Device>(device: T): Observable<FirebaseDevice<T>>;
    withDevice<T extends Device>(device: T): Observable<FirebaseDevice<T>> {
        return new Observable<FirebaseDevice<T>>(observer => {
            const firebaseDevice = isScene(device)
                ? new FirebaseSceneDevice(this, device, this.logger)
                : new FirebaseDevice<T>(this, device, this.logger);
            observer.next(firebaseDevice);
            this.devices$.next(this.devices$.value.concat(firebaseDevice));

            return () => {
                this.devices$.next(this.devices$.value.filter(d => d !== firebaseDevice));
            };
        });
    }

    async updateState(deviceId: string, state: Partial<Device['state']>) {
        await this.queueHttpCall({
            path: 'client/update-state',
            body: state,
            query: `id=${encodeURIComponent(deviceId)}`
        });
    }

    private async syncDevices(devices: FirebaseDevice[]) {
        await this.queueHttpCall({
            path: 'client/sync',
            body: devices.map(d => d.device),
        });
    }

    private async handleJob<T>(job: Job<T>) {
        try {
            const result = await job.factory();
            job.resolve(result);
        } catch (err) {
            job.reject(err);
        }
    }

    private async queueHttpCall({
        path,
        query = '',
        method = 'POST',
        body,
    }: {
        path: string,
        query?: string,
        method?: string,
        body: any,
    }) {
        return new Promise((resolve, reject) => {
            this.jobQueue$.next({
                factory: async () => {
                    const token = await this.app.auth().currentUser?.getIdToken();
                    const url = `${functionsEndpoint}${path}?group=${encodeURIComponent(this.group)}&${query}`;
                    const response = await fetch(url, {
                        method: method,
                        agent: this.agent,
                        headers: {
                            'authorization': `Bearer ${token}`,
                            'content-type': 'application/json',
                        },
                        body: body ? JSON.stringify(body) : undefined,
                    });
                    if (response.status !== 200) {
                        throw new Error(`HTTP response (${response.status} ${await response.text()})`);
                    }
                    return response;
                },
                resolve,
                reject,
            });
        });
    }
}

interface Job<T = any> {
    factory: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}
