import { TransportControlDevice, TransportControlIncomingCommand } from '@andrei-tatar/nora-firebase-common';
import firebase from 'firebase/app';
import { merge, Observable, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Logger, singleton } from '..';
import { FirebaseDevice } from './device';
import { FirebaseSync } from './sync';

const COMMAND_PREFIX = 'action.devices.commands.media';

export class FirebaseTransportControlDevice<T extends TransportControlDevice> extends FirebaseDevice<T> {
    constructor(
        cloudId: string,
        sync: FirebaseSync,
        device: T,
        logger: Logger | null,
    ) {
        super(cloudId, sync, device, logger);
    }

    private readonly command = this.noraSpecific.child('pendingTransportControlCommand');
    private localCommand$ = new Subject<TransportControlIncomingCommand>();

    readonly command$ = merge(
        new Observable<TransportControlIncomingCommand>(observer => {
            const handler = (snapshot: firebase.database.DataSnapshot) => {
                const value = snapshot.val();
                if (value) {
                    observer.next(value);
                }
            };
            this.command.on('value', handler);
            return () => this.command.off('value', handler);
        }).pipe(
            switchMap(async v => {
                await this.command.remove();
                return v;
            }),
        ),
        this.localCommand$).pipe(
            singleton(),
        );

    override executeCommand(command: string, params: any) {
        if (command.startsWith(COMMAND_PREFIX)) {
            const mediaCommand = command.substr(COMMAND_PREFIX.length);
            this.localCommand$.next({
                command: mediaCommand.toUpperCase(),
                ...params,
            });
            return this.device.state;
        } else {
            return super.executeCommand(command, params);
        }
    }
}
