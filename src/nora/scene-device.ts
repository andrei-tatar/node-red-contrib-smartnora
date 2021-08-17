import { SceneDevice } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { merge, Observable, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Logger, singleton } from '..';
import { FirebaseDevice } from './device';
import { FirebaseSync } from './sync';

export class FirebaseSceneDevice<T extends SceneDevice> extends FirebaseDevice<T> {
    constructor(
        cloudId: string,
        sync: FirebaseSync,
        device: T,
        logger: Logger | null,
    ) {
        super(cloudId, sync, device, logger);
    }

    private readonly pendingScene = this.noraSpecific.child('pendingScene');
    private activateSceneLocal$ = new Subject<{ deactivate: boolean }>();

    readonly activateScene$ = merge(
        new Observable<{ deactivate: boolean }>(observer => {
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
        ),
        this.activateSceneLocal$).pipe(
            singleton(),
        );

    override async executeCommand(command: string, params: any) {
        if (command === 'action.devices.commands.ActivateScene') {
            this.activateSceneLocal$.next({ deactivate: params?.deactivate ?? false });
            return this.device.state;
        } else {
            return await super.executeCommand(command, params);
        }
    }
}
