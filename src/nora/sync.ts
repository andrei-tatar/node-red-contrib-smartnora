import { Agent } from 'https';
import {
    HEARTBEAT_TIMEOUT_SEC, SceneDevice, Device, isScene, isTransportControlDevice,
    isChannelDevice, WebpushNotification, ObjectDetectionNotification
} from '@andrei-tatar/nora-firebase-common';
import { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { DatabaseReference, getDatabase, onValue, ref, remove, set } from 'firebase/database';
import {
    BehaviorSubject, combineLatest, concat, defer, EMPTY, merge, Observable, of, Subject, throwError, timer
} from 'rxjs';
import {
    catchError, concatMap, debounceTime, delayWhen, distinctUntilChanged, groupBy, ignoreElements, map, mergeMap,
    retry, startWith, switchMap, tap,
} from 'rxjs/operators';
import {
    getHash, HttpError, Logger, publishReplayRefCountWithDelay, rateLimitSlidingWindow,
    retryWithBackoff, scanWithFactory, singleton
} from '..';
import { API_ENDPOINT, USER_AGENT } from '../config';
import { fetch } from './fetch';
import { FirebaseDevice } from './device';
import { DeviceContext } from './device-context';
import { FirebaseMediaDevice } from './media-device';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
    private db;
    private agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 15000,
    });

    private devices$ = new BehaviorSubject<FirebaseDevice[]>([]);
    private jobQueue$ = new Subject<JobInQueue>();
    private lastSyncHash = '~';

    private sync$ = this.devices$.pipe(
        debounceTime(500),
        delayWhen(() => {
            // spread out the sync calls
            const miliseconds = Math.round(Math.random() * 200) * 50;
            return timer(miliseconds);
        }),
        switchMap(devices =>
            concat(
                defer(() => this.syncDevices(devices.map(d => d.device))),
                merge(...devices.map(d => d.connectedAndSynced$)),
            )
        ),
        retry({
            delay: err => {
                if (err instanceof UnauthenticatedError) {
                    return throwError(() => err);
                }

                const seconds = Math.round(Math.random() * 1200) / 20 + 30;
                this.logger?.warn(`nora: ${this.group} - unhandled error (trying again in ${seconds} sec): ${err.message}\n${err.stack}`);
                return timer(seconds * 1000);
            }
        }),
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
        mergeMap(job =>
            concat(
                this.handleJob(job),
                defer(() => {
                    job.resolve();
                    return EMPTY;
                }),
            ).pipe(
                catchError(err => {
                    job.reject(err);
                    return EMPTY;
                })), 1),
        ignoreElements(),
        publishReplayRefCountWithDelay(1000),
    );

    private groupUpdateHeartbeat$ = combineLatest([
        this.getOffset(),
        timer(0, HEARTBEAT_TIMEOUT_SEC * 1000),
    ]).pipe(
        map(([{ offset }]) => new Date().getTime() + offset),
        switchMap(timestamp => set(this.groupHeartbeat, timestamp)),
        retryWithBackoff({
            logError: (err) => this.logger?.warn(`nora: while sending heartbeat: ${err.message}`),
        }),
    ).pipe(ignoreElements());

    readonly connected$ = new Observable<boolean>(observer => onValue(this.connected, s => observer.next(!!s.val()))).pipe(
        distinctUntilChanged(),
        tap(connected => this.logger?.info(`nora: ${this.group} - ${connected ? 'connected' : 'disconnected'}`)),
        switchMap(connected => connected
            ? merge(this.handleJobs$, this.sync$, this.groupUpdateHeartbeat$, of(connected))
            : of(connected)
        ),
        singleton(),
    );

    readonly uid: string;
    readonly states: DatabaseReference;
    readonly noraSpecific: DatabaseReference;
    readonly groupHeartbeat: DatabaseReference;
    private readonly connected: DatabaseReference;

    constructor(
        private app: FirebaseApp,
        private readonly group: string,
        private logger: Logger | null,
    ) {
        const user = getAuth(this.app).currentUser;
        if (!user) {
            throw new UnauthenticatedError();
        }
        this.uid = user.uid;
        this.db = getDatabase(app);
        this.states = ref(this.db, `device_states/${this.uid}/${this.group}`);
        this.noraSpecific = ref(this.db, `device_nora/${this.uid}/${this.group}`);
        this.groupHeartbeat = ref(this.db, `user/${this.uid}/version/${this.group}/heartbeat`);
        this.connected = ref(this.db, '.info/connected');
    }

    withDevice<T extends SceneDevice>(device: T, p?: DeviceParams): Observable<FirebaseSceneDevice<T>>;
    withDevice<T extends Device>(device: T, p?: DeviceParams): Observable<FirebaseDevice<T>>;
    withDevice<T extends Device>(device: T,
        { ctx, disableValidationErrors = false }: DeviceParams = {}): Observable<FirebaseDevice<T>> {
        return new Observable<FirebaseDevice<T>>(observer => {
            const cloudId = `${this.group}|${device.id}`;
            const firebaseDevice = isScene(device)
                ? new FirebaseSceneDevice(cloudId, this, device, this.logger, disableValidationErrors)
                : isTransportControlDevice(device) || isChannelDevice(device)
                    ? new FirebaseMediaDevice(cloudId, this, device, this.logger, disableValidationErrors)
                    : new FirebaseDevice<T>(cloudId, this, device, this.logger, disableValidationErrors);
            observer.next(firebaseDevice);
            this.devices$.next(this.devices$.value.concat(firebaseDevice as any));
            return () => this.devices$.next(this.devices$.value.filter(d => d !== firebaseDevice));
        }).pipe(
            switchMap(d => ctx
                ? merge(
                    d.error$.pipe(tap(ctx?.error$), ignoreElements()),
                    d.local$.pipe(tap(ctx?.local$), ignoreElements()),
                    d.state$.pipe(map(s => s.online), tap(ctx?.online$), ignoreElements()),
                    of(d)
                )
                : of(d))
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
        await this.queueJob({
            type: 'notify',
            notification,
        });
    }

    async sendGoogleHomeNotification(deviceId: string, notification: ObjectDetectionNotification) {
        await this.queueJob({
            type: 'notify-home',
            deviceId,
            notification,
        });
    }

    watchForActions(identifier: string): Observable<string> {
        const actionRef = ref(this.db, `user/${this.uid}/actions/${identifier}`);
        return new Observable<string>(observer =>
            onValue(actionRef, s => {
                const value: { action: string; timestamp: number } | null = s.val();
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

    private async syncDevices(devices: Device[]) {
        const syncAttributes = devices.map(({ id, attributes, name }) => ({ id, attributes, name }));
        syncAttributes.sort((a, b) => a.id.localeCompare(b.id));

        const hash = getHash(syncAttributes);
        if (this.lastSyncHash === hash) {
            this.logger?.info(`nora: ${this.group} - no device changes`);
            return;
        }

        await this.queueJob({
            type: 'sync',
            devices,
        });
        this.lastSyncHash = hash;
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
                previous.resolve();
                return current;

            case 'report-state':
                if (previous.job.type !== 'report-state') {
                    throw new Error('can\'t merge jobs with different types');
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
                previous.reject(new RateLimitingError('too many notifications per sec'));
                return current;

            case 'notify-home':
                previous.resolve();
                return current;
        }
    }

    private handleJob({ job }: JobInQueue) {
        switch (job.type) {
            case 'sync':
                return this.doHttpCall({
                    path: 'sync',
                    body: job.devices,
                });

            case 'report-state':
                return this.doHttpCall({
                    path: 'update-state',
                    query: `id=${encodeURIComponent(job.deviceId)}`,
                    body: job.update,
                });

            case 'notify':
                return this.doHttpCall({
                    path: 'notify',
                    body: job.notification,
                });

            case 'notify-home':
                return this.doHttpCall({
                    path: 'home-notify',
                    body: job.notification,
                    query: `id=${encodeURIComponent(job.deviceId)}`,
                });

            default:
                return EMPTY;
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

    private doHttpCall({
        path,
        query = '',
        body,
    }: {
        path: string;
        query?: string;
        method?: string;
        body: {};
    }) {
        return defer(async () => {
            const user = getAuth(this.app).currentUser;
            if (!user) {
                throw new UnauthenticatedError();
            }
            const token = await user.getIdToken();
            const url = `${API_ENDPOINT}/client/${path}?group=${encodeURIComponent(this.group)}&${query}`;
            const response = await fetch(url, {
                method: 'POST',
                agent: this.agent,
                headers: {
                    'authorization': `Bearer ${token}`,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'user-agent': `${USER_AGENT}:${this.uid}`,
                },
                body,
            });
            if (!response.ok) {
                throw new HttpError(response.status, await response.text());
            }
            return response;
        }).pipe(
            retryWithBackoff({
                maxRetryCount: 3,
                shouldRetry: (err) => !(err instanceof HttpError) || this.shouldRetryRequest(err.statusCode),
            }),
            ignoreElements(),
        );
    }

    private shouldRetryRequest(status: number) {
        if (status === 429) {
            return true;
        }

        const h = Math.floor(status / 100);
        return h !== 2 && h !== 4;
    }

    private getOffset() {
        return defer(async () => {
            const user = getAuth(this.app).currentUser;
            if (!user) {
                throw new UnauthenticatedError();
            }
            const token = await user.getIdToken();

            const response = await fetch<{ offset: number }>(`${API_ENDPOINT}/client/offset?timestamp=${new Date().getTime()}`, {
                method: 'GET',
                agent: this.agent,
                headers: {
                    'authorization': `Bearer ${token}`,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'user-agent': `${USER_AGENT}:${this.uid}`,
                },
            });
            const { offset } = await response.json();

            return { offset };
        }).pipe(
            concatMap((value) => timer(0, HEARTBEAT_TIMEOUT_SEC * 1000).pipe(
                scanWithFactory((ctx, _) => {
                    // get offset again when time changes with more than a max error in one period
                    // this is in order to recalibrate server offset when time updates
                    const now = new Date().getTime();

                    if (ctx.last !== -1) {
                        const delta = Math.abs(((now - ctx.last) / 1000) - HEARTBEAT_TIMEOUT_SEC);
                        if (delta > 10) {
                            throw new Error('offset changed');
                        }
                    }

                    ctx.last = now;
                    return ctx;
                }, () => ({ last: -1 })),
                ignoreElements(),
                startWith(value),
            )),
        );
    }
}

export class UnauthenticatedError extends Error {
    constructor() {
        super('No user authenticated');
    }
}

export class RateLimitingError extends Error {
    constructor(msg?: string) {
        super(msg);
    }
}

interface SyncJob {
    type: 'sync';
    devices: Device[];
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

interface SendHomeNotificationJob {
    type: 'notify-home';
    notification: ObjectDetectionNotification;
    deviceId: string;
}

type Job = SyncJob | ReportStateJob | SendNotificationJob | SendHomeNotificationJob;

interface JobInQueue {
    job: Job;
    resolve: (value?: any) => void;
    reject: (err: any) => void;
}

interface DeviceParams {
    ctx?: DeviceContext;
    disableValidationErrors?: boolean;
}
