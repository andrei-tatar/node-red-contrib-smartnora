import { Device, HEARTBEAT_TIMEOUT_SEC, isChannelDevice, isScene, isTransportControlDevice, SceneDevice, WebpushNotification } from '@andrei-tatar/nora-firebase-common';
import { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { DatabaseReference, get, getDatabase, onValue, ref, remove, set } from 'firebase/database';
import { Agent } from 'https';
import fetch, { Response } from 'node-fetch';
import { BehaviorSubject, concat, defer, merge, Observable, of, Subject, timer } from 'rxjs';
import {
    debounceTime, delayWhen, distinctUntilChanged, groupBy, ignoreElements,
    map,
    mergeMap, retryWhen, switchMap, tap,
} from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay, rateLimitSlidingWindow, singleton } from '..';
import { apiEndpoint } from '../config';
import { FirebaseDevice } from './device';
import { DeviceContext } from './device-context';
import { FirebaseMediaDevice } from './media-device';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
    private db;
    private userAgent: string;
    private agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 15000,
    });

    private devices$ = new BehaviorSubject<FirebaseDevice<any>[]>([]);
    private jobQueue$ = new Subject<JobInQueue>();

    private sync$ = this.devices$.pipe(
        debounceTime(500),
        delayWhen(() => {
            // spread out the sync calls
            const miliseconds = Math.round(Math.random() * 200) * 50;
            return timer(miliseconds);
        }),
        switchMap(devices =>
            concat(
                defer(() => this.syncDevices()),
                merge(...devices.map(d => d.connectedAndSynced$)),
            )
        ),
        retryWhen(err$ => err$.pipe(
            delayWhen(err => {
                const seconds = Math.round(Math.random() * 1200) / 20 + 30;
                this.logger?.warn(`nora: ${this.group} - unhandled error (trying again in ${seconds} sec): ${err.message}\n${err.stack}`);
                return timer(seconds * 1000);
            })
        )),
        ignoreElements(),
        singleton(),
    );

    private handleJobs$ = this.jobQueue$.pipe(
        groupBy(this.getJobId),
        mergeMap(jobsByType => jobsByType.pipe(
            rateLimitSlidingWindow(
                60000,
                12,
                this.mergeJob
            )
        )),
        mergeMap(job => this.handleJob(job), 1),
        ignoreElements(),
        publishReplayRefCountWithDelay(1000),
    );

    private groupUpdateHeartbeat$ = timer(0, HEARTBEAT_TIMEOUT_SEC * 1000).pipe(
        switchMap(_ => set(this.groupHeartbeat, new Date().getTime())),
        retryWhen(err$ =>
            err$.pipe(tap(err => {
                this.logger?.warn(`nora: while sending heartbeat: ${err.message}\n${err.stack}`);
            }))
        ),
    ).pipe(ignoreElements());

    readonly connected$ = new Observable<boolean>(observer => {
        return onValue(this.connected, s => observer.next(!!s.val()));
    }).pipe(
        distinctUntilChanged(),
        tap(connected => this.logger?.info(`nora: ${this.group} - ${connected ? 'connected' : 'disconnected'}`)),
        switchMap(connected => connected
            ? merge(this.handleJobs$, this.sync$, this.groupUpdateHeartbeat$, of(connected))
            : of(connected)
        ),
        singleton(),
    );

    readonly uid: string | undefined;
    readonly states: DatabaseReference;
    readonly noraSpecific: DatabaseReference;
    readonly groupHeartbeat: DatabaseReference;
    private readonly connected: DatabaseReference;

    constructor(
        private app: FirebaseApp,
        private readonly group: string = '<default>',
        private logger: Logger | null,
    ) {
        this.uid = getAuth(this.app).currentUser?.uid;
        this.db = getDatabase(app);
        this.states = ref(this.db, `device_states/${this.uid}/${this.group}`);
        this.noraSpecific = ref(this.db, `device_nora/${this.uid}/${this.group}`);
        this.groupHeartbeat = ref(this.db, `user/${this.uid}/version/${this.group}/heartbeat`);
        this.connected = ref(this.db, '.info/connected');
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
                : isTransportControlDevice(device) || isChannelDevice(device)
                    ? new FirebaseMediaDevice(cloudId, this, device, this.logger)
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
                        d.state$.pipe(map(s => s.online), tap(ctx?.online$), ignoreElements()),
                        of(d)
                    )
                    : of(d);
            })
        );
    }

    async updateState(deviceId: string, state: Partial<Device['state']>) {
        await this.queueJob({
            type: 'report-state',
            deviceId,
            update: state,
        });
    }

    async sendNotification(notification: WebpushNotification) {
        if (await this.hasDeviceTokens()) {
            await this.queueJob({
                type: 'notify',
                notification,
            });
        }
    }

    watchForActions(identifier: string): Observable<string> {
        const actionRef = ref(this.db, `user/${this.uid}/actions/${identifier}`);
        return new Observable<string>(observer =>
            onValue(actionRef, s => {
                const value: { action: string, timestamp: number } | null = s.val();
                if (value) {
                    observer.next(value.action);
                }
            })
        ).pipe(
            switchMap(async v => {
                await remove(actionRef);
                return v;
            }),
        );
    }

    private async hasDeviceTokens() {
        const tokensRef = ref(this.db, `user/${this.uid}/device_tokens`);
        const tokens: string[] | null = await get(tokensRef).then(s => s.val());
        return !!tokens?.length;
    }

    private async syncDevices() {
        await this.queueJob({ type: 'sync' });
        this.logger?.info(`nora: ${this.group} - synced ${this.devices$.value.length} device(s)`);
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
                        update: {
                            ...previous.job.update,
                            ...current.job.update,
                        },
                    },
                    resolve: current.resolve,
                    reject: current.reject,
                };

            case 'notify':
                previous.reject(new Error('too many notifications per sec'));
                return current;
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
    }: {
        path: string,
        query?: string,
        method?: string,
        body: any,
        tries?: number,
    }) {
        while (tries--) {
            const token = await getAuth(this.app).currentUser?.getIdToken();
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
                const delay = Math.round(Math.random() * 20) * 50 + 300;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            return response;
        }
    }

    private shouldRetryRequest(response: Response) {
        if (response.status === 429) {
            return true;
        }

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
