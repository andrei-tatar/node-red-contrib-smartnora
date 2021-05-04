import { Device } from '@andrei-tatar/nora-firebase-common';
import { connectable, MonoTypeOperatorFunction, Observable, ReplaySubject, Subscription } from 'rxjs';
import { share } from 'rxjs/operators';

export interface NodeInterface {
    credentials: { [key: string]: string };

    on(type: 'input', callback: (msg: { payload: any, topic?: string }) => void): void;
    on(type: 'close', callback: () => void): void;

    send(msg: any): void;

    log(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;

    status(params: {
        fill: 'red' | 'green' | 'yellow' | 'blue' | 'grey',
        text: string,
        shape: 'ring' | 'dot',
    } | {}): void;
}

export interface Logger {
    trace(message?: any, ...optionalParams: any[]): void;
    debug(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
}

export interface ConfigNode {
    email: string;
    password: string;
    group?: string;
    valid: boolean;
    localExecution: boolean;

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

const NO_EVENT = Symbol('no-event');

export function throttleAfterFirstEvent<T>(
    time: (event: T) => number,
    mergeEvents: (current: T, previous: T) => T): MonoTypeOperatorFunction<T> {
    return source => new Observable<T>(observer => {
        let timer: NodeJS.Timer | null = null;
        let lastEvent: T | Symbol = NO_EVENT;

        const timeoutHandler = () => {
            timer = null;
            if (lastEvent !== NO_EVENT) {
                observer.next(lastEvent as T);
                lastEvent = NO_EVENT;
            }
        };

        return source.subscribe({
            next: event => {
                if (!timer) {
                    observer.next(event);
                    timer = setTimeout(timeoutHandler, time(event));
                } else {
                    if (lastEvent !== NO_EVENT) {
                        event = mergeEvents(event, <T>lastEvent);
                    }
                    lastEvent = event;
                    clearTimeout(timer);
                    timer = setTimeout(timeoutHandler, time(event));
                }
            },
            error: error => {
                timer && clearTimeout(timer);
                observer.error(error);
            },
            complete: () => {
                timer && clearTimeout(timer);
                observer.complete();
            },
        });
    });
}

export function singleton<T>(): MonoTypeOperatorFunction<T> {
    return source => source.pipe(
        share({
            connector: () => new ReplaySubject(1),
            resetOnRefCountZero: true,
        })
    );
}
