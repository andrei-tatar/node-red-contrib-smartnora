import firebase from 'firebase/app';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { publishReplayRefCountWithDelay } from '..';

export class DisconnectRules {
    private static cache = new Map<string, Observable<never>>();

    static getDisconnectRule(id: string, factory: () => firebase.database.OnDisconnect): Observable<never> {
        let cached = this.cache.get(id);
        if (!cached) {
            cached = new Observable<never>(_ => {
                const rule = factory();
                return () => rule.cancel();
            }).pipe(
                finalize(() => this.cache.delete(id)),
                publishReplayRefCountWithDelay(1000),
            );
            this.cache.set(id, cached);
        }

        return cached;
    }
}
