import { BaseDevice, Device, isScene, SceneDevice } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import {
    debounceTime, distinctUntilChanged, first, ignoreElements,
    publish, publishReplay, refCount, switchMap,
} from 'rxjs/operators';
import { FirebaseDevice } from './device';
import { FirebaseSceneDevice } from './scene-device';

export class FirebaseSync {
    private db: firebase.database.Database;
    private ids$ = new BehaviorSubject<string[]>([]);

    private syncIds$ = this.ids$.pipe(
        debounceTime(2000),
        switchMap(_ => this.removeMissingDevices()),
        ignoreElements(),
        publish(),
        refCount(),
    );

    readonly connected$ = new Observable<boolean>(observer => {
        const handler = (s: firebase.database.DataSnapshot) => observer.next(s.val());
        const connected = this.db.ref('.info/connected');
        connected.on('value', handler);
        return () => connected.off('value', handler);
    }).pipe(
        distinctUntilChanged(),
        publishReplay(1),
        refCount(),
    );

    get uid() {
        return this.app.auth().currentUser?.uid;
    }

    private deviceIds() {
        return this.db.ref(`device_ids/${this.uid}/${this.group}`);
    }

    get states() {
        return this.db.ref(`device_states/${this.uid}/${this.group}`);
    }

    get attributes() {
        return this.db.ref(`device_attributes/${this.uid}/${this.group}`);
    }

    get noraSpecific() {
        return this.db.ref(`device_nora/${this.uid}/${this.group}`);
    }

    constructor(
        private app: firebase.app.App,
        private readonly group: string = '<default>',
    ) {
        this.db = firebase.database(app);
    }

    createDevice<T extends SceneDevice>(device: T): Observable<FirebaseSceneDevice<T>>;
    createDevice<T extends BaseDevice>(device: T): Observable<FirebaseDevice<T>>;
    createDevice<T extends BaseDevice>(device: T): Observable<FirebaseDevice<T>> {
        return merge(this.syncIds$, new Observable<FirebaseDevice<T>>(observer => {
            this.ids$.next(this.ids$.value.concat(device.id));
            if (isScene(device)) {
                observer.next(new FirebaseSceneDevice(this, device));
            } else {
                observer.next(new FirebaseDevice<T>(this, device));
            }

            return () => {
                const filtered = this.ids$.value.filter(v => v !== device.id);
                this.ids$.next(filtered);
            };
        })).pipe(
            switchMap(async dev => {
                await dev.init();
                return dev;
            })
        );
    }

    private async removeMissingDevices() {
        const [allIds, cloudIds] = await Promise.all([
            this.ids$.pipe(first()).toPromise(),
            this.deviceIds().once('value').then(v => v.val() as CloudIds),
        ]);

        const toDeleteIds = cloudIds?.ids?.filter(id => !allIds.includes(id)) ?? [];

        await Promise.all([
            this.deviceIds().set({
                ids: allIds,
                timestamp: new Date().getTime(),
            } as CloudIds),
            ...toDeleteIds.map(id => [
                this.states.child(id).remove(),
                this.attributes.child(id).remove(),
                this.noraSpecific.child(id).remove(),
            ]),
        ]);
    }

    async updateState(device: Device) {
        this.states.child(device.id).set(device.state);
    }
}

interface CloudIds {
    ids: string[];
    timestamp: number;
}
