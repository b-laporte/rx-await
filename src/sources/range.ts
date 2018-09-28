import { TaskToken } from './../core/types';
import { Observable } from '../core/observable';
import { isTaskRef, task } from '../core/tasks';

export function range(start: number, count: number): Observable<number>;
export function range($$: TaskToken, start: number, count: number): Observable<number>;
export function range($$OrStart: number | TaskToken = 0, startOrCount: number = 0, count: number = 0): Observable<number> {
    let start = 0, $$: TaskToken | null = null;

    if (isTaskRef($$OrStart)) {
        $$ = $$OrStart! as TaskToken;
        start = startOrCount;
    } else {
        start = $$OrStart as number;
        count = startOrCount;
    }

    return new Observable<number>($$, ($$, output) => {
        let index = 0, current = start;
        do {
            if (index++ >= count) {
                output.complete();
                break;
            }
            output.next(current++);
            if (output.closed) {
                break;
            }
        } while (true);
    });
}
