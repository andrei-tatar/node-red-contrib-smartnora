import { Device } from '@andrei-tatar/nora-firebase-common';
import {
    concat, connectable, EMPTY, MonoTypeOperatorFunction,
    Observable, of, ReplaySubject, Subscription, timer
} from 'rxjs';
import { filter, map, scan, share, switchMap } from 'rxjs/operators';

export interface NodeMessage extends Record<string, any> {
    payload: any;
    topic?: string;
}

export interface NodeInterface {
    credentials: { [key: string]: string };

    on(type: 'input', callback: (msg: NodeMessage, send?: (msgToSend: NodeMessage) => void, done?: (err?: any) => void) => void): void;
    on(type: 'close', callback: () => void): void;

    send(msg: any): void;

    log(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;

    status(params: {
        fill: 'red' | 'green' | 'yellow' | 'blue' | 'grey';
        text: string;
        shape: 'ring' | 'dot';
    } | {}): void;

    context(): {
        get<T>(key: string): T;
        set<T>(key: string, value: T): void;
    };
}

export interface Logger {
    trace(message?: any): void;
    debug(message?: any): void;
    info(message?: any): void;
    warn(message?: any): void;
    error(message?: any): void;
}

export interface ConfigNode {
    email: string;
    password: string;
    group?: string;
    valid: boolean;
    localExecution: boolean;
    storeStateInContext: boolean;

    setCommon<T extends Device>(device: T, deviceConfig?: any): T;
}

export function publishReplayRefCountWithDelay<T>(delay: number): MonoTypeOperatorFunction<T> {
    return source => {
        const connectable$ = connectable(source, { connector: () => new ReplaySubject<T>(1) });

        let refCount = 0;
        let timeout: any;
        let subscription: Subscription | null = null;

        return new Observable(observer => {
            connectable$.subscribe(observer);
            refCount++;
            clearTimeout(timeout);
            if (refCount === 1 && subscription === null) {
                subscription = connectable$.connect();
            }

            return () => {
                refCount--;
                if (refCount === 0) {
                    timeout = setTimeout(() => {
                        subscription?.unsubscribe();
                        subscription = null;
                    }, delay);
                }
            };
        });
    };
}

const NO_EVENT: unknown = Symbol('no-event');

interface RateLimitContext<T> {
    overflow: T;
    fwdMessage: T;
    ticks: number[];
    getNextFree(): Date;
}

export function rateLimitSlidingWindow<T>(
    windowSizeMiliseconds: number,
    numberOfEvents: number,
    mergeEvents: (current: T, previous: T) => T): MonoTypeOperatorFunction<T> {
    return source => source.pipe(
        scan<T, RateLimitContext<T>>((ctx, msg) => {
            const now = new Date().getTime();
            ctx.ticks = ctx.ticks.filter(t => t > now - windowSizeMiliseconds);
            if (ctx.ticks.length === numberOfEvents) {
                ctx.overflow = ctx.overflow !== NO_EVENT ? mergeEvents(msg, ctx.overflow) : msg;
                ctx.fwdMessage = NO_EVENT as T;
            } else {
                ctx.fwdMessage = ctx.overflow !== NO_EVENT ? mergeEvents(msg, ctx.overflow) : msg;
                ctx.overflow = NO_EVENT as T;
                ctx.ticks.push(now);
            }
            return ctx;
        }, {
            overflow: NO_EVENT as T,
            fwdMessage: NO_EVENT as T,
            ticks: [],
            getNextFree() {
                const eventsThatWereSentInTheWindow = this.ticks.slice(-numberOfEvents - 1);
                const nextFreeEvent = new Date(eventsThatWereSentInTheWindow[0] + windowSizeMiliseconds + 500);
                return nextFreeEvent;
            },
        }),
        switchMap(ctx => {
            const forward$ = ctx.fwdMessage === NO_EVENT ? EMPTY : of(ctx.fwdMessage);
            const overflow$ = ctx.overflow === NO_EVENT ? EMPTY :
                timer(ctx.getNextFree()).pipe(
                    map(_ => {
                        const value = ctx.overflow;
                        if (value !== NO_EVENT) {
                            ctx.overflow = NO_EVENT as T;
                            ctx.ticks.push(new Date().getTime());
                        }
                        return value;
                    }),
                    filter(c => c !== NO_EVENT),
                );

            return concat(forward$, overflow$);
        }),
    );
}

export function singleton<T>(): MonoTypeOperatorFunction<T> {
    return source => source.pipe(
        share({
            connector: () => new ReplaySubject(1),
            resetOnRefCountZero: true,
        })
    );
}
