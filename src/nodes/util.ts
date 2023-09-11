import { Device, updateState, validate } from '@andrei-tatar/nora-firebase-common';
import { EMPTY, firstValueFrom, merge, MonoTypeOperatorFunction, Observable, of, Subject } from 'rxjs';
import { retry, switchMap, takeUntil } from 'rxjs/operators';
import { ConfigNode, NodeInterface, NodeMessage, singleton } from '..';
import { FirebaseConnection } from '../nora/connection';
import { FirebaseDevice } from '../nora/device';
import { DeviceContext } from '../nora/device-context';
import { LocalExecution } from '../nora/local-execution';
import { getSafeUpdate } from '../nora/safe-update';

export function convertValueType(RED: any, value: any, type: any,
    { defaultType = 'bool', defaultValue = false }: { defaultType?: string; defaultValue?: any } = {}) {
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

export function escapeFirebasePath(value: string): string {
    return value.replace(/[.#$\[\]]/g, ':');
}

export function getId({ id }: { id: string }) {
    return escapeFirebasePath(id);
}

export function getNumberOrDefault(a: any, defaultValue = 0) {
    const nr = +a;
    if (isFinite(nr)) {
        return nr;
    }
    return defaultValue;
}

export function registerNoraDevice<T extends Device>(node: NodeInterface, RED: any, nodeConfig: any, options: {
    deviceConfig: Omit<T, 'id'>;
    updateStatus?: (opts: {
        state: T['state'];
        update: (state: string) => void;
    }) => void;
    mapStateToOutput?: (state: T['state']) => NodeMessage | null | undefined;
    handleNodeInput?: (opts: {
        msg: NodeMessage;
        updateState: FirebaseDevice<T>['updateState'];
        device$: Observable<FirebaseDevice<T>>;
        state$: Observable<T['state']>;
    }) => Promise<void> | void;
    customRegistration?: (device$: Observable<FirebaseDevice<T>>) => Observable<any>;
}) {
    const noraConfig: ConfigNode = RED.nodes.getNode(nodeConfig.nora);
    if (!noraConfig?.valid) {
        return;
    }

    const close$ = getClose(node);
    const ctx = new DeviceContext(node);
    ctx.startUpdating(close$);

    const deviceConfig = noraConfig.setCommon<T>({
        id: getId(nodeConfig),
        ...options.deviceConfig,
    } as T, nodeConfig);

    const configureOutputMessage = (msg: NodeMessage) => ({
        ...msg,
        ... (nodeConfig.topic ? {
            topic: nodeConfig.topic,
        } : null),
        ... (noraConfig.sendDeviceNameAndLocation ? {
            device: deviceConfig.name.name,
            location: deviceConfig.roomHint,
        } : null),
    });

    if (noraConfig.storeStateInContext) {
        const contextState = node.context().get<T['state']>('state');

        const safeUpdate = {};
        getSafeUpdate({
            update: contextState ?? {},
            safeUpdateObject: safeUpdate,
            currentState: deviceConfig.state,
            isValid: () => validate(deviceConfig.traits, 'state-update', safeUpdate).valid,
            warn: (propName) => node.warn(`ignoring property from stored context ${propName}`),
        });
        const { state: safeState } = updateState(safeUpdate, deviceConfig.state);
        deviceConfig.state = safeState;
    }

    const device$ = FirebaseConnection
        .withLogger(RED.log)
        .fromConfig(noraConfig, ctx)
        .pipe(
            switchMap(connection => connection.withDevice(deviceConfig, {
                ctx,
                disableValidationErrors: noraConfig.disableValidationErrors,
            })),
            withLocalExecution(noraConfig),
            singleton(),
            takeUntil(close$),
        );

    let subscriptions = 0;

    if (options.updateStatus || noraConfig.storeStateInContext) {
        device$.pipe(
            switchMap(d => d.state$),
            takeUntil(close$),
        ).subscribe(state => {
            if (noraConfig.storeStateInContext) {
                node.context().set('state', state);
            }
            options.updateStatus?.({
                state,
                update: msg => ctx.status$.next(msg),
            });
        });
        subscriptions++;
    }

    if (options.mapStateToOutput) {
        device$.pipe(
            switchMap(d => d.stateUpdates$),
            takeUntil(close$),
        ).subscribe(state => {
            const output = options?.mapStateToOutput?.(state);
            if (output) {
                node.send(configureOutputMessage(output));
            }
        });
        subscriptions++;
    }

    if (deviceConfig.noraSpecific.asyncCommandExecution === true ||
        Array.isArray(deviceConfig.noraSpecific.asyncCommandExecution) &&
        deviceConfig.noraSpecific.asyncCommandExecution.length) {
        const padding = new Array<null>(nodeConfig.outputs - 1).fill(null);
        device$.pipe(
            switchMap(d => d.asyncCommands$),
            takeUntil(close$),
        ).subscribe(({ id, command }) => {
            node.send([
                ...padding,
                {
                    _asyncCommandId: id,
                    payload: {
                        command: command.command.substring(command.command.lastIndexOf('.') + 1),
                        ...command.params,
                    },
                },
            ]);
        });
        subscriptions++;
    }

    if (options.handleNodeInput) {
        handleNodeInput({
            node,
            nodeConfig,
            configure: msg => configureOutputMessage(msg),
            handler: msg => options?.handleNodeInput?.({
                msg,
                updateState: async (...args) => {
                    const device = await firstValueFrom(device$);
                    return await device.updateState(...args);
                },
                device$,
                state$: device$.pipe(switchMap(d => d.state$)),
            }),
        });
    }

    if (!subscriptions) {
        device$.subscribe();
    }

    options?.customRegistration?.(device$)?.pipe(
        takeUntil(close$),
        retry({
            delay: err => {
                node.warn(err);
                return of(err);
            },
        }),
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
    node: NodeInterface;
    nodeConfig?: any;
    handler: (msg: NodeMessage) => void | Promise<void>;
    configure?: (msg: NodeMessage) => NodeMessage;
}) {
    opts.node.on('input', async (msg, send, done) => {
        if (opts.nodeConfig?.filter &&
            opts.nodeConfig?.topic &&
            `${opts.nodeConfig?.topic}` !== `${msg.topic}`) {
            done?.();
            return;
        }

        if (opts.nodeConfig?.passthru) {
            const sendMessage = send ?? opts.node.send.bind(opts.node);
            const output = opts.configure?.(msg) ?? msg;
            sendMessage(output);
        }

        try {
            await opts.handler(msg);
            done?.();
        } catch (err) {
            if (done) {
                done(err);
            } else {
                opts.node.error(`${err}`);
            }
        }
    });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function R(template: TemplateStringsArray, ...substiutions: any[]): string {
    return String.raw(template, ...substiutions.map(v => {
        if (typeof v === 'number') {
            return Math.round(v * 10) / 10;
        }
        return v;
    }));
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
