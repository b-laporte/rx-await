import { TaskToken } from './../core/types';
import { Observable } from '../core/observable';
import { isTaskRef } from '../core/tasks';

export function of<T>(...values: T[]): Observable<T>;
export function of<T>($$: TaskToken, ...values: T[]): Observable<T>;
export function of<T>(...$$OrValues: Array<TaskToken | T>): Observable<T> {
    let $$: TaskToken | null = null, values: [T];

    let v0 = $$OrValues[0];
    if (isTaskRef(v0)) {
        $$ = v0! as TaskToken;
        $$OrValues.shift();
    }
    values = $$OrValues as [T];

    return new Observable<T>($$, ($$, output) => {
        let len = values.length;
        for (let i = 0; len > i; i++) {
            output.next(values[i]);
            if (output.closed) {
                break;
            }
        }
    });
}
