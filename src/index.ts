import { createHash } from 'crypto';
import { Device } from '@andrei-tatar/nora-firebase-common';
import { concat, defer, EMPTY, MonoTypeOperatorFunction, of, OperatorFunction, ReplaySubject, timer } from 'rxjs';
import { filter, map, retry, scan, share, switchMap } from 'rxjs/operators';

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
    password?: string;
    sso?: string;
    group: string;
    valid: boolean;
    localExecution: boolean;
    storeStateInContext: boolean;
    disableValidationErrors: boolean;
    sendDeviceNameAndLocation: boolean;

    setCommon<T extends Device>(device: T, deviceConfig?: any): T;
}

export function publishReplayRefCountWithDelay<T>(delay: number): MonoTypeOperatorFunction<T> {
    return share({
        connector: () => new ReplaySubject(1),
        resetOnComplete: true,
        resetOnError: true,
        resetOnRefCountZero: () => timer(delay),
    });
}

export function retryWithBackoff<T>(config?: RetryWithBackoffConfig): MonoTypeOperatorFunction<T> {
    const { initialInterval = 100, maxRetryCount = 6, logError, shouldRetry } = config ?? {};
    return retry({
        delay: (error, retryCount) => {
            logError?.(error);
            const attemptRetry = shouldRetry?.(error) ?? true;
            if (attemptRetry) {
                return timer(Math.pow(2, retryCount) * initialInterval);
            }
            throw error;
        },
        count: maxRetryCount,
        resetOnSuccess: true,
    });
}

interface RetryWithBackoffConfig {
    initialInterval?: number;
    maxRetryCount?: number;
    logError?: (err: any) => void;
    shouldRetry?: (err: any) => boolean;
}


export function scanWithFactory<T, A>(next: (accumulator: A, item: T) => A, factory: () => A): OperatorFunction<T, A> {
    return source => defer(() => scan(next, factory())(source));
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

export class HttpError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly content: string) {
        super(`HTTP response (${statusCode} ${content})`);
    }
}

export function getHash(input: string | object): string {
    if (typeof input !== 'string') {
        input = JSON.stringify(flattenObject(input));
    }
    return createHash('sha256').update(input).digest('base64');
}

function flattenObject(input: object): any {
    switch (typeof input) {
        case 'string':
        case 'boolean':
        case 'number':
            return input;
    }

    if (Array.isArray(input)) {
        return input;
    }

    const entries = Object.entries(input);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([key, value]) => [key, flattenObject(value)]);
}

export function cloneDeep<T>(input: T): T {
    return JSON.parse(JSON.stringify(input));
}
