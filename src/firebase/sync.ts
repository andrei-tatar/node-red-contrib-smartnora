import { Device, isScene, SceneDevice } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { Agent } from 'https';
import fetch from 'node-fetch';
import { BehaviorSubject, concat, EMPTY, merge, Observable, of, Subject } from 'rxjs';
import {
    catchError,
    debounceTime, distinctUntilChanged, groupBy, ignoreElements,
    mergeMap,
    publish, publishReplay, refCount, switchMap,
} from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay, throttleAfterFirstEvent } from '..';
import { apiEndpoint } from '../config';
import { FirebaseDevice } from './device';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
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
        catchError(err => {
            this.logger?.warn(`unhandled error: ${err.message}\n${err.stack}`);
            return EMPTY;
        }),
    );

    private handleJobs$ = this.jobQueue$.pipe(
        groupBy(this.getJobId),
        mergeMap(jobsByType => jobsByType.pipe(
            throttleAfterFirstEvent(5000, this.mergeJob)
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
        const db = firebase.database(app);
        this.states = db.ref(`device_states/${this.uid}/${this.group}`);
        this.noraSpecific = db.ref(`device_nora/${this.uid}/${this.group}`);
        this.connected = db.ref('.info/connected');
    }

    withDevice<T extends SceneDevice>(device: T): Observable<FirebaseSceneDevice<T>>;
    withDevice<T extends Device>(device: T): Observable<FirebaseDevice<T>>;
    withDevice<T extends Device>(device: T): Observable<FirebaseDevice<T>> {
        return new Observable<FirebaseDevice<T>>(observer => {
            const cloudId = `${this.group}|${device.id}`;
            const firebaseDevice = isScene(device)
                ? new FirebaseSceneDevice(cloudId, this, device, this.logger)
                : new FirebaseDevice<T>(cloudId, this, device, this.logger);
            observer.next(firebaseDevice);
            this.devices$.next(this.devices$.value.concat(firebaseDevice));

            return () => {
                this.devices$.next(this.devices$.value.filter(d => d !== firebaseDevice));
            };
        });
    }

    async updateState(deviceId: string, state: Partial<Device['state']>) {
        await this.queueJob({
            type: 'report-state',
            deviceId,
            update: state,
        });
    }

    private async syncDevices() {
        await this.queueJob({
            type: 'sync',
        });
    }

    private getJobId(j: JobInQueue) {
        switch (j.job.type) {
            case 'sync':
                return j.job.type;
            case 'report-state':
                return `${j.job.type}-${j.job.deviceId}`;
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
                previous.reject(new Error('update was merged with a new one'));
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
        }
    }

    private async handleJob({ job, reject, resolve }: JobInQueue) {
        try {
            switch (job.type) {
                case 'sync':
                    const devices = this.devices$.value;
                    const version = require('../../package.json').version;
                    await this.doHttpCall({
                        path: 'sync',
                        query: `version=${encodeURIComponent(version)}`,
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
    }: {
        path: string,
        query?: string,
        method?: string,
        body: any,
    }) {
        const token = await this.app.auth().currentUser?.getIdToken();
        const url = `${apiEndpoint}${path}?group=${encodeURIComponent(this.group)}&${query}`;
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

type Job = SyncJob | ReportStateJob;

interface JobInQueue {
    job: Job;
    resolve: (value?: any) => void;
    reject: (err: Error) => void;
}
