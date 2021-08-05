import { Device } from '@andrei-tatar/nora-firebase-common';
import { EMPTY, firstValueFrom, merge, MonoTypeOperatorFunction, Observable, of, Subject } from 'rxjs';
import { retryWhen, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface, NodeMessage, singleton } from '..';
import { FirebaseConnection } from '../nora/connection';
import { FirebaseDevice } from '../nora/device';
import { DeviceContext } from '../nora/device-context';
import { LocalExecution } from '../nora/local-execution';

export function convertValueType(RED: any, value: any, type: any,
    { defaultType = 'bool', defaultValue = false }: { defaultType?: string, defaultValue?: any } = {}) {
    if (type === 'flow' || type === 'global') {
        try {
            const parts = RED.util.normalisePropertyExpression(value);
            if (parts.length === 0) {
                throw new Error();
            }
        } catch (err) {
            value = defaultValue;
            type = defaultType;
        }
    }
    return { value, type };
}

export function getValue(RED: any, node: any, value: any, type: any) {
    if (type === 'date') {
        return Date.now();
    } else {
        return RED.util.evaluateNodeProperty(value, type, node);
    }
}

export function getId({ id }: { id: string }) {
    return id.replace('.', ':');
}

export function getNumberOrDefault(a: any, defaultValue = 0) {
    const nr = +a;
    if (isFinite(nr)) { return nr; }
    return defaultValue;
}

export function registerNoraDevice<T extends Device>(node: NodeInterface, RED: any, nodeConfig: any, options: {
    deviceConfig: Omit<T, 'id'>,
    updateStatus?: (opts: {
        state: T['state'],
        update: (state: string) => void,
    }) => void,
    stateChanged?: (state: T['state']) => void,
    handleNodeInput?: (opts: {
        msg: NodeMessage,
        updateState: FirebaseDevice<T>['updateState'],
        state$: Observable<T['state']>,
    }) => Promise<void> | void,
    customRegistration?: (device$: Observable<FirebaseDevice<T>>) => Observable<any>,
}) {
    const noraConfig: ConfigNode = RED.nodes.getNode(nodeConfig.nora);
    if (!noraConfig?.valid) { return; }

    const close$ = getClose(node);
    const ctx = new DeviceContext(node);
    ctx.startUpdating(close$);

    const deviceConfig = noraConfig.setCommon<T>({
        id: getId(nodeConfig),
        ...options.deviceConfig,
    } as T, nodeConfig);

    const device$ = FirebaseConnection
        .withLogger(RED.log)
        .fromConfig(noraConfig, ctx)
        .pipe(
            switchMap(connection => connection.withDevice(deviceConfig, ctx)),
            withLocalExecution(noraConfig),
            singleton(),
            takeUntil(close$),
        );

    if (options.updateStatus) {
        device$.pipe(
            switchMap(d => d.state$),
            tap(state => options.updateStatus?.({
                state,
                update: msg => ctx.state$.next(msg),
            })),
            takeUntil(close$),
        ).subscribe();
    }

    if (options.stateChanged) {
        device$.pipe(
            switchMap(d => d.stateUpdates$),
            takeUntil(close$),
        ).subscribe(state => options?.stateChanged?.(state));
    }

    if (options.handleNodeInput) {
        handleNodeInput({
            node,
            nodeConfig,
            handler: msg => options?.handleNodeInput?.({
                msg,
                updateState: async (...args) => {
                    const device = await firstValueFrom(device$);
                    return await device.updateState(...args);
                },
                state$: device$.pipe(switchMap(d => d.state$)),
            }),
        });
    }

    options?.customRegistration?.(device$)?.pipe(
        takeUntil(close$),
        retryWhen(err$ => err$.pipe(tap(err => node.warn(err)))),
    )?.subscribe();
}

export function getClose(node: NodeInterface) {
    const close$ = new Subject<void>();
    node.on('close', () => {
        close$.next();
        close$.complete();
    });
    return close$.asObservable();
}

export function handleNodeInput(opts: {
    node: NodeInterface,
    nodeConfig?: any,
    handler: (msg: NodeMessage) => void | Promise<void>,
}) {
    opts.node.on('input', async (msg, send, done) => {
        if (opts.nodeConfig?.filter && `${opts.nodeConfig?.topic}` !== `${msg.topic}`) {
            done?.();
            return;
        }

        if (opts.nodeConfig?.passthru) {
            const sendMessage = send ?? opts.node.send.bind(opts.node);
            sendMessage(msg);
        }

        try {
            await opts.handler(msg);
            done?.();
        } catch (err) {
            if (done) {
                done(err);
            } else {
                opts.node.error(err);
            }
        }
    });
}

function withLocalExecution<T>(config: ConfigNode): MonoTypeOperatorFunction<T> {
    return source => source.pipe(
        switchMap(device => {
            if (!(device instanceof FirebaseDevice)) {
                throw new Error('device must derive FirebaseDevice');
            }

            return merge(
                config.localExecution
                    ? LocalExecution.instance.registerDeviceForLocalExecution(device)
                    : EMPTY,
                of(device)
            );
        }),
    );
}
