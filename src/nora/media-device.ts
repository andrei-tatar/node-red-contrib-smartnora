import { AppSelectorDevice, ChannelDevice, TransportControlDevice,
    TransportControlIncomingCommand } from '@andrei-tatar/nora-firebase-common';
import { COMMAND_HANDLERS } from '@andrei-tatar/nora-firebase-common';
import { child, DatabaseReference, DataSnapshot, onValue, remove } from 'firebase/database';
import { merge, Observable, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Logger, singleton } from '..';
import { FirebaseDevice } from './device';
import { FirebaseSync } from './sync';

const TRANSPORT_CONTROL_COMMAND_PREFIX = 'action.devices.commands.media';
const CHANNEL_COMMAND = /^action\.devices\.commands\.(?:return|relative|select)Channel$/;
const APP_SELECTOR_COMMAND = /^action\.devices\.commands\.app(?:Search|Install)$/;

export type ChannelChangeCommand = ChannelDevice['noraSpecific']['pendingChannelChangeCommand'];
export type AppSelectorCommand = AppSelectorDevice['noraSpecific']['pendingAppSelectorCommand'];
export type MediaCommand = TransportControlIncomingCommand | ChannelChangeCommand | AppSelectorCommand;

export class FirebaseMediaDevice<T extends (TransportControlDevice | ChannelDevice | AppSelectorDevice)> extends FirebaseDevice<T> {
    constructor(
        cloudId: string,
        sync: FirebaseSync,
        device: T,
        logger: Logger | null,
    ) {
        super(cloudId, sync, device, logger);
    }

    private readonly transportControlCommand = child(this.noraSpecific, 'pendingTransportControlCommand');
    private readonly channelChangeCommand = child(this.noraSpecific, 'pendingChannelChangeCommand');
    private readonly appSelectorCommand = child(this.noraSpecific, 'pendingAppSelectorCommand');
    private readonly localCommand$ = new Subject<MediaCommand>();

    readonly mediaCommand$ = merge(
        FirebaseMediaDevice.command<TransportControlIncomingCommand>(this.transportControlCommand),
        FirebaseMediaDevice.command<ChannelChangeCommand>(this.channelChangeCommand),
        FirebaseMediaDevice.command<AppSelectorCommand>(this.appSelectorCommand),
        this.localCommand$,
    ).pipe(
        singleton(),
    );

    private static command<TCommand>(reference: DatabaseReference) {
        return new Observable<TCommand>(observer =>
            onValue(reference, (snapshot: DataSnapshot) => {
                const value = snapshot.val();
                if (value) {
                    observer.next(value);
                }
            })
        ).pipe(
            switchMap(async v => {
                await remove(reference);
                return v;
            }),
        );
    }

    override async executeCommand(command: string, params: any) {
        if (command.startsWith(TRANSPORT_CONTROL_COMMAND_PREFIX)) {
            const mediaCommand = command.substr(TRANSPORT_CONTROL_COMMAND_PREFIX.length);
            this.localCommand$.next({
                command: mediaCommand.toUpperCase(),
                ...params,
            });
            return this.device.state;
        } else if (CHANNEL_COMMAND.test(command)) {
            const handler = COMMAND_HANDLERS.get(command);
            const result = handler?.(this.device, params);
            if (result?.updateNoraSpecific && 'pendingChannelChangeCommand' in result.updateNoraSpecific) {
                this.localCommand$.next(result.updateNoraSpecific.pendingChannelChangeCommand);
                return this.device.state;
            }
        } else if (APP_SELECTOR_COMMAND.test(command)) {
            const handler = COMMAND_HANDLERS.get(command);
            const result = handler?.(this.device, params);
            if (result?.updateNoraSpecific && 'pendingAppSelectorCommand' in result.updateNoraSpecific) {
                this.localCommand$.next(result.updateNoraSpecific.pendingAppSelectorCommand);
                return this.device.state;
            }
        }


        return await super.executeCommand(command, params);
    }
}
