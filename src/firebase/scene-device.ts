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

    readonly activateScene$ = new Observable<{ deactivate: boolean }>(observer => {
        const handler = (snapshot: firebase.database.DataSnapshot) => {
            const value = snapshot.val();
            if (value) {
                observer.next(value);
            }
        };
        this.noraSpecific.child('pendingScene').on('value', handler);
        return () => this.state.off('value', handler);
    }).pipe(
        switchMap(async v => {
            await this.noraSpecific.child('pendingScene').remove();
            return v;
        }),
    );

}
