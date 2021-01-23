import { SceneDevice } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { FirebaseDevice } from './device';
import { FirebaseSync } from './sync';

export class FirebaseSceneDevice<T extends SceneDevice> extends FirebaseDevice<T> {
    constructor(
        sync: FirebaseSync,
        device: T,
    ) {
        super(sync, device);
    }

    private readonly pendingScene = this.noraSpecific.child('pendingScene');

    readonly activateScene$ = new Observable<{ deactivate: boolean }>(observer => {
        const handler = (snapshot: firebase.database.DataSnapshot) => {
            const value = snapshot.val();
            if (value) {
                observer.next(value);
            }
        };
        this.pendingScene.on('value', handler);
        return () => this.pendingScene.off('value', handler);
    }).pipe(
        switchMap(async v => {
            await this.pendingScene.remove();
            return v;
        }),
    );

}
