import { createSocket, Socket } from 'dgram';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { networkInterfaces } from 'os';
import { encodeAsync } from 'cbor';
import { deviceSupportsLocalExecution, ExecuteCommandError } from '@andrei-tatar/nora-firebase-common';
import { BehaviorSubject, EMPTY, merge, Observable } from 'rxjs';
import { filter, ignoreElements, switchMap } from 'rxjs/operators';
import { Logger, publishReplayRefCountWithDelay } from '..';
import { FirebaseDevice } from './device';

const DISCOVERY_PACKET = Buffer.from('021dfa122e51acb0b9ea5fbce02741ba69a37a203bd91027978cf29557cbb5b6', 'hex');
const DISCOVERY_PORT = 6988;
const DISCOVERY_REPLY_PORT = 6989;
const HTTP_PORT = 6987;

export class LocalExecution {
    private static readonly proxyId = LocalExecution.getUniqueId();
    private static logger: Logger | null;
    static readonly instance = new LocalExecution();

    private devices$ = new BehaviorSubject<FirebaseDevice[]>([]);

    private discovery$ = new Observable<{ socket: Socket; data: Buffer; from: string }>(observer => {
        const socket = createSocket('udp4');
        socket.on('message', (msg, rinfo) => observer.next({ socket, data: msg, from: rinfo.address }));
        socket.bind(DISCOVERY_PORT);
        return () => socket.close();
    }).pipe(
        filter(msg => msg.data.compare(DISCOVERY_PACKET) === 0),
        switchMap(async ({ socket, from }) => {
            LocalExecution.logger?.trace('[nora][local-execution] Received discovery packet, sending reply');
            const responsePacket = await encodeAsync({
                type: 'proxy',
                proxyId: LocalExecution.proxyId,
                port: HTTP_PORT,
            });
            socket.send(responsePacket, DISCOVERY_REPLY_PORT, from);
        }),
    );

    private server$ = new Observable(_ => {
        const server = createServer(async (req, res) => {
            if (req.url === '/nora-local-execution' && req.method === 'POST') {
                const body = await this.readBody<{
                    type: 'EXECUTE';
                    deviceId: string;
                    command: string;
                    params: any;
                }>(req);
                switch (body.type) {
                    case 'EXECUTE':
                        LocalExecution.logger?.trace(`[nora][local-execution] Executing ${body.command} - device: ${body.deviceId}`);
                        const device = this.devices$.value.find(d => d.cloudId === body.deviceId);
                        try {
                            if (device) {
                                const state = await device.executeCommand(body.command, body.params);
                                this.sendJson(res, state);
                            } else {
                                this.sendJson(res, { errorCode: 'deviceNotFound' });
                            }
                        } catch (err) {
                            if (err instanceof ExecuteCommandError) {
                                this.sendJson(res, { errorCode: err.errorCode });
                            } else {
                                this.sendJson(res, { errorCode: 'deviceNotReady' });
                            }
                        }
                        return;
                }
            }

            // eslint-disable-next-line @typescript-eslint/naming-convention
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('NOT FOUND');
        });
        server.listen(HTTP_PORT);
        return () => server.close();
    });

    private services$ = merge(this.discovery$, this.server$).pipe(
        publishReplayRefCountWithDelay(1000),
    );

    private static getUniqueId() {
        // we need a unique device id that stays the same between reboots or restarts.
        // Google Home doesn't start a new discovery process very often

        const interfaces = networkInterfaces();
        for (const [_, networks] of Object.entries(interfaces)) {
            for (const net of (networks ?? [])) {
                if (net.mac !== '00:00:00:00:00:00') {
                    return net.mac.replace(/:/gm, '');
                }
            }
        }

        const random = new Array(16).fill(0).map(_ => Math.floor(Math.random() * 255));
        return Buffer.from(random).toString('hex');
    }

    static withLogger(logger: Logger) {
        this.logger ??= logger;
        return this;
    }

    registerDeviceForLocalExecution(device: FirebaseDevice): Observable<never> {
        if (!deviceSupportsLocalExecution(device.device)) {
            LocalExecution.logger?.trace(`[nora][local-execution] ${device.device.name}, doesn't support local execution, skipping`);
            return EMPTY;
        }

        device.device.otherDeviceIds = [{ deviceId: device.cloudId }];
        device.device.customData = {
            proxyId: LocalExecution.proxyId,
        };
        return merge(
            this.services$,
            new Observable(_ => {
                this.devices$.next(this.devices$.value.concat(device));
                return () => {
                    this.devices$.next(this.devices$.value.filter(v => v !== device));
                };
            })
        ).pipe(
            ignoreElements(),
        );
    }

    private readBody<T>(request: IncomingMessage) {
        return new Promise<T>((resolve, reject) => {
            const body: Uint8Array[] = [];
            request
                .on('data', (chunk) => body.push(chunk))
                .on('error', (err) => reject(err))
                .on('end', () => {
                    try {
                        const bodyString = Buffer.concat(body).toString();
                        resolve(JSON.parse(bodyString));
                    } catch (err) {
                        reject(err);
                    }
                });
        });
    }

    private sendJson(res: ServerResponse, body: object) {
        res.writeHead(200, {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'content-type': 'application/json'
        });
        res.write(JSON.stringify(body));
        res.end();
    }
}
