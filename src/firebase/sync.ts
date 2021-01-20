import { BaseDevice, Device, isScene, SceneDevice } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { Agent } from 'https';
import fetch from 'node-fetch';
import { concat, merge, Observable, of, Subject } from 'rxjs';
import {
    debounceTime, distinctUntilChanged, ignoreElements,
    publish, publishReplay, refCount, scan, switchMap,
} from 'rxjs/operators';
import { functionsEndpoint } from '../config';
import { FirebaseDevice } from './device';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
    private events$ = new Subject<DeviceEvent>();
    private agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 5000,
    });

    private devices$ = this.events$.pipe(
        scan((devices: FirebaseDevice[], event: DeviceEvent) => {
            switch (event.type) {
                case 'add':
                    return [...devices, event.device];
                case 'remove':
                    return devices.filter(d => d.device.id !== event.deviceId);
            }
        }, []),
        publishReplay(1),
        refCount(),
    );

    private sync$ = this.devices$.pipe(
        debounceTime(1000),
        switchMap(devices =>
            concat([
                this.syncDevices(devices),
                merge(devices.map(d => d.updates$)),
            ]),
        ),
        ignoreElements(),
        publish(),
        refCount(),
    );

    readonly connected$ = new Observable<boolean>(observer => {
        const handler = (s: firebase.database.DataSnapshot) => observer.next(s.val());
        this.connected.on('value', handler);
        return () => this.connected.off('value', handler);
    }).pipe(
        switchMap(connected => connected
            ? merge(this.sync$, of(connected))
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
    ) {
        this.uid = this.app.auth().currentUser?.uid;
        const db = firebase.database(app);
        this.states = db.ref(`device_states/${this.uid}/${this.group}`);
        this.noraSpecific = db.ref(`device_nora/${this.uid}/${this.group}`);
        this.connected = db.ref('.info/connected');
    }

    withDevice<T extends SceneDevice>(device: T): Observable<FirebaseSceneDevice<T>>;
    withDevice<T extends BaseDevice>(device: T): Observable<FirebaseDevice<T>>;
    withDevice<T extends BaseDevice>(device: T): Observable<FirebaseDevice<T>> {
        return new Observable<FirebaseDevice<T>>(observer => {
            const firebaseDevice = isScene(device)
                ? new FirebaseSceneDevice(this, device)
                : new FirebaseDevice<T>(this, device);
            observer.next(firebaseDevice);

            this.events$.next({ type: 'add', device: firebaseDevice });

            return () => {
                this.events$.next({ type: 'remove', deviceId: device.id });
            };
        });
    }

    async updateState(deviceId: string, state: Partial<Device['state']>) {
        await this.http({
            path: 'client/update-state',
            body: state,
            query: `id=${encodeURIComponent(deviceId)}`
        });
    }

    private async syncDevices(devices: FirebaseDevice[]) {
        await this.http({
            path: 'client/sync',
            body: devices.map(d => d.device),
        });
    }

    private async http({
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
        const response = await fetch(`${functionsEndpoint}${path}?group=${encodeURIComponent(this.group)}&${query}`, {
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

type DeviceEvent = {
    type: 'add',
    device: FirebaseDevice,
} | {
    type: 'remove',
    deviceId: string,
};
