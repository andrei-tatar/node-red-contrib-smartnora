import { Device, isScene, SceneDevice, WebpushNotification } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { Agent } from 'https';
import fetch, { Response } from 'node-fetch';
import { BehaviorSubject, concat, merge, Observable, of, Subject, timer } from 'rxjs';
import {
    debounceTime, delayWhen, distinctUntilChanged, groupBy, ignoreElements,
    mergeMap, publish, publishReplay, refCount, retryWhen, switchMap, tap,
} from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay, throttleAfterFirstEvent } from '..';
import { apiEndpoint } from '../config';
import { FirebaseDevice } from './device';
import { DeviceContext } from './device-context';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
    private db;
    private userAgent;
    private agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 15000,
    });

    private devices$ = new BehaviorSubject<FirebaseDevice<any>[]>([]);
    private jobQueue$ = new Subject<JobInQueue>();

    private sync$ = this.devices$.pipe(
        debounceTime(1000),
        switchMap(devices =>
            concat(
                this.syncDevices(),
                merge(...devices.map(d => d.connectedAndSynced$)),
            ),
        ),
        ignoreElements(),
        publish(),
        refCount(),
        retryWhen(err$ => err$.pipe(
            delayWhen(err => {
                const seconds = Math.round(Math.random() * 120) / 2 + 30;
                this.logger?.warn(`unhandled error (trying again in ${seconds} sec): ${err.message}\n${err.stack}`);
                return timer(seconds * 1000);
            })
        )),
    );

    private handleJobs$ = this.jobQueue$.pipe(
        groupBy(this.getJobId),
        mergeMap(jobsByType => jobsByType.pipe(
            throttleAfterFirstEvent(
                m => m.job.type === 'report-state' && m.job.fromLocalExecution
                    ? 500
                    : 5000,
                this.mergeJob
            )
        )),
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
        this.db = firebase.database(app);
        this.states = this.db.ref(`device_states/${this.uid}/${this.group}`);
        this.noraSpecific = this.db.ref(`device_nora/${this.uid}/${this.group}`);
        this.connected = this.db.ref('.info/connected');
        const { name, version } = require('../../package.json');
        this.userAgent = `${name}/${version}`;
    }

    withDevice<T extends SceneDevice>(device: T, ctx?: DeviceContext): Observable<FirebaseSceneDevice<T>>;
    withDevice<T extends Device>(device: T, ctx?: DeviceContext): Observable<FirebaseDevice<T>>;
    withDevice<T extends Device>(device: T, ctx?: DeviceContext): Observable<FirebaseDevice<T>> {
        return new Observable<FirebaseDevice<T>>(observer => {
            const cloudId = `${this.group}|${device.id}`;
            const firebaseDevice = isScene(device)
                ? new FirebaseSceneDevice(cloudId, this, device, this.logger)
                : new FirebaseDevice<T>(cloudId, this, device, this.logger);
            observer.next(firebaseDevice);
            this.devices$.next(this.devices$.value.concat(firebaseDevice));
            return () => this.devices$.next(this.devices$.value.filter(d => d !== firebaseDevice));
        }).pipe(
            switchMap(d => {
                return ctx
                    ? merge(
                        d.error$.pipe(tap(ctx?.error$), ignoreElements()),
                        d.local$.pipe(tap(ctx?.local$), ignoreElements()),
                        of(d)
                    )
                    : of(d);
            })
        );
    }

    async updateState(deviceId: string, state: Partial<Device['state']>, fromLocalExecution = false) {
        await this.queueJob({
            type: 'report-state',
            deviceId,
            update: state,
            fromLocalExecution,
        });
    }

    async sendNotification(notification: WebpushNotification) {
        await this.queueJob({
            type: 'notify',
            notification,
        });
    }

    watchForActions(identifier: string): Observable<string> {
        const ref = this.db.ref(`user/${this.uid}/actions/${identifier}`);
        return new Observable<string>(observer => {
            const handler = (snapshot: firebase.database.DataSnapshot) => {
                const value: { action: string, timestamp: number } | null = snapshot.val();
                if (value) {
                    observer.next(value.action);
                }
            };
            ref.on('value', handler);
            return () => ref.off('value', handler);
        }).pipe(
            switchMap(async v => {
                await ref.remove();
                return v;
            }),
        );
    }

    private async syncDevices() {
        await this.queueJob({ type: 'sync' });
        this.logger?.info(`nora: synced ${this.devices$.value.length} device(s), group: ${this.group}`);
    }

    private getJobId(j: JobInQueue) {
        switch (j.job.type) {
            case 'report-state':
                return `${j.job.type}-${j.job.deviceId}`;
            default:
                return j.job.type;
        }
    }

    private mergeJob(current: JobInQueue, previous: JobInQueue): JobInQueue {
        switch (current.job.type) {
            case 'sync':
                if (previous.job.type !== 'sync') {
                    throw new Error(`can't merge jobs with different types`);
                }
                previous.resolve();
                return current;

            case 'report-state':
                if (previous.job.type !== 'report-state') {
                    throw new Error(`can't merge jobs with different types`);
                }
                previous.resolve();
                return {
                    job: {
                        type: current.job.type,
                        deviceId: current.job.deviceId,
                        fromLocalExecution: current.job.fromLocalExecution || previous.job.fromLocalExecution,
                        update: {
                            ...previous.job.update,
                            ...current.job.update,
                        },
                    },
                    resolve: current.resolve,
                    reject: current.reject,
                };
            case 'notify':
                current.reject(new Error('too many notifications per sec'));
                return previous;
        }
    }

    private async handleJob({ job, reject, resolve }: JobInQueue) {
        try {
            switch (job.type) {
                case 'sync':
                    const devices = this.devices$.value;
                    await this.doHttpCall({
                        path: 'sync',
                        body: devices.map(d => d.device),
                    });
                    break;
                case 'report-state':
                    await this.doHttpCall({
                        path: 'update-state',
                        query: `id=${encodeURIComponent(job.deviceId)}`,
                        body: job.update,
                    });
                    break;
                case 'notify':
                    await this.doHttpCall({
                        path: 'notify',
                        body: job.notification,
                    });
                    break;
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    }

    private async queueJob(job: Job) {
        return new Promise((resolve, reject) => {
            this.jobQueue$.next({
                job,
                resolve,
                reject
            });
        });
    }

    private async doHttpCall({
        path,
        query = '',
        method = 'POST',
        body,
        tries = 3,
        delayBetweenRetries = 500,
    }: {
        path: string,
        query?: string,
        method?: string,
        body: any,
        tries?: number,
        delayBetweenRetries?: number,
    }) {
        while (tries--) {
            const token = await this.app.auth().currentUser?.getIdToken();
            const url = `${apiEndpoint}${path}?group=${encodeURIComponent(this.group)}&${query}`;
            const response = await fetch(url, {
                method: method,
                agent: this.agent,
                headers: {
                    'authorization': `Bearer ${token}`,
                    'content-type': 'application/json',
                    'user-agent': this.userAgent,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (response.status !== 200) {
                const shouldRetry = this.shouldRetryRequest(response);
                if (!shouldRetry || !tries) {
                    throw new HttpError(response.status, await response.text());
                }
                await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
                continue;
            }
            return response;
        }
    }

    private shouldRetryRequest(response: Response) {
        const status = Math.floor(response.status / 100);
        return status !== 2 && status !== 4;
    }
}

export class HttpError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly content: string) {
        super(`HTTP response (${statusCode} ${content})`);
    }
}

interface SyncJob {
    type: 'sync';
}

interface ReportStateJob {
    type: 'report-state';
    deviceId: string;
    update: { [key: string]: any };
    fromLocalExecution: boolean;
}

interface SendNotificationJob {
    type: 'notify';
    notification: WebpushNotification;
}

type Job = SyncJob | ReportStateJob | SendNotificationJob;

interface JobInQueue {
    job: Job;
    resolve: (value?: any) => void;
    reject: (err: Error) => void;
}
