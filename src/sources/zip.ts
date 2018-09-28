import { Observable } from '../core/observable';
import { promise } from '../operators/promise';
import { TaskToken } from '../core/types';
import { isTaskRef } from '../core/tasks';


export function zip(sources: Observable<any>[]): Observable<any[]>
export function zip($$: TaskToken, sources: Observable<any>[]): Observable<any[]>;
export function zip($$OrSources: TaskToken | Observable<any>[], sources?: Observable<any>[]): Observable<any[]> {
    let $$: TaskToken | null = null;
    if (isTaskRef($$OrSources)) {
        $$ = $$OrSources! as TaskToken;
    } else {
        sources = $$OrSources! as Observable<any>[];
    }
    sources = sources || [];
    let dimension = sources.length;

    return new Observable<any[]>($$, ($$, output) => {
        // buffer of the values received: buffer[i][0] === next value to push for stream #i
        let buffer: any[][] = [];

        function checkValues() {
            // check if values can be pushed to output
            if (buffer.length < dimension) {
                return;
            }
            // return if all slots are not filled
            for (let i = 0; dimension > i; i++) {
                if (!buffer[i] || buffer[i].length === 0) {
                    return;
                }
            }
            // output new value
            let outValue: any[] = [];
            for (let i = 0; dimension > i; i++) {
                outValue[i] = buffer[i].shift();
            }
            output.next(outValue);
        }

        return promise($$, (resolve, reject, onCancel) => {
            onCancel(() => {
                buffer = [];
            })
            for (let i = 0; dimension > i; i++) {
                sources![i].subscribe((value: any) => {
                    if (output.closed) {
                        return resolve();
                    }
                    if (!buffer[i]) {
                        buffer[i] = [value];
                    } else {
                        buffer[i].push(value);
                    }
                    checkValues();
                }, (error) => {
                    // ignore errors
                }, () => {
                    // complete
                    buffer = [];
                    output.complete();
                    resolve();
                });
            }
        });
    });
}
