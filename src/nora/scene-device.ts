import { SceneDevice } from '@andrei-tatar/nora-firebase-common';
import { child, onValue, remove } from 'firebase/database';
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

    private readonly pendingScene = child(this.noraSpecific, 'pendingScene');
    private activateSceneLocal$ = new Subject<{ deactivate: boolean }>();

    readonly activateScene$ = merge(
        new Observable<{ deactivate: boolean }>(observer =>
            onValue(this.pendingScene, s => {
                const value = s.val();
                if (value) {
                    observer.next(value);
                }
            })
        ).pipe(
            switchMap(async v => {
                await remove(this.pendingScene);
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
