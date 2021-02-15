import { Device } from '@andrei-tatar/nora-firebase-common';
import { MonoTypeOperatorFunction, Observable, ReplaySubject, Subscription } from 'rxjs';
import { multicast } from 'rxjs/operators';

export interface NodeInterface {
    credentials: { [key: string]: string };

    on(type: 'input', callback: (msg: { payload: any, topic?: string }) => void): void;
    on(type: 'close', callback: () => void): void;

    send(msg: any): void;

    log(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;

    status(params: { fill: string, text: string, shape: string }): void;
}

export interface Logger {
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
}

export interface ConfigNode {
    email: string;
    password: string;
    group?: string;
    valid: boolean;
    localExecution: boolean;

    setCommon<T extends Device>(device: T): T;
}

export function publishReplayRefCountWithDelay<T>(delay: number): MonoTypeOperatorFunction<T> {
    return source => {
        const connectable = multicast(new ReplaySubject<T>(1))(source);

        let refCount = 0;
        let timeout: any;
        let subscription: Subscription | null = null;

        return new Observable(observer => {
            connectable.subscribe(observer);
            refCount++;
            clearTimeout(timeout);
            if (refCount === 1 && subscription === null) {
                subscription = connectable.connect();
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
    time: number,
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

        return source.subscribe(
            event => {
                if (!timer) {
                    observer.next(event);
                    timer = setTimeout(timeoutHandler, time);
                } else {
                    if (lastEvent !== NO_EVENT) {
                        event = mergeEvents(event, <T>lastEvent);
                    }
                    lastEvent = event;
                    clearTimeout(timer);
                    timer = setTimeout(timeoutHandler, time);
                }
            },
            error => {
                timer && clearTimeout(timer);
                observer.error(error);
            },
            () => {
                timer && clearTimeout(timer);
                observer.complete();
            }
        );
    });
}
