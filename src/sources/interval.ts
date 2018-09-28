import { Observable } from '../core/observable';
import { promise } from '../operators/promise';
import { TaskToken } from '../core/types';
import { isTaskRef } from '../core/tasks';

/**
 * Creates an Observable that emits sequential numbers every specified interval of time
 * @param period the time interval in ms (default is 0)
 */

export function interval(period: number): Observable<number>;
export function interval($$: TaskToken, period: number): Observable<number>;
export function interval($$OrPeriod: TaskToken | number, period = 0): Observable<number> {
    let $$: TaskToken | null = null;

    if (isTaskRef($$OrPeriod)) {
        $$ = $$OrPeriod! as TaskToken;
    } else {
        period = $$OrPeriod as number;
    }

    return new Observable<number>($$, ($$, output) => {
        return promise($$, (resolve, reject, onCancel) => {
            let count = 0,
                id = setInterval(() => {
                    if (!output.closed) {
                        output.next(count++);
                    } 
                }, period);
            onCancel(() => {
                clearInterval(id);
            })
        });
    });
}
