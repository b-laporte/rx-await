import { TaskToken, CancellablePromise } from '../core/types';
import { task } from '../core/tasks';
import { noop } from '../core/observable';

/**
 * Generate a cancellable promise that will be automatically cancelled if not fulfilled when the task completes
 * e.g.
 * return promise($$, (resolve, reject, onCancel) => {
 *     let id = setTimeout(resolve, durationMs);
 *     onCancel(() => clearTimeout(id));
 * });
 * @param executor the promise functions to execute (resolve, reject, onCancel)
 */
export function promise<T>($$: TaskToken, executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void, onCancel: (fn: (reason?: any) => void) => void) => void): CancellablePromise<T> {
    let cancelFn: ((reason?: any) => void) | null = null,
        rejectFn: ((reason?: any) => void) | null,
        currentTask = task($$),
        isResolved = false,
        isComplete = currentTask.isComplete(),
        c: { unsubscribe: Function | null } = { unsubscribe: null }

    let p = new Promise((resolve, reject) => {
        rejectFn = reject;
        function onCancel(fn: (reason?: any) => void) {
            cancelFn = fn;
        }
        function resolve2(v) {
            if (c.unsubscribe) {
                c.unsubscribe();
            }
            isResolved = true;
            resolve(v);
        }
        if (isComplete) {
            reject();
        } else {
            executor(resolve2, reject, onCancel);
        }
    }) as CancellablePromise<any>;;

    p.cancel = function (reason?: any) {
        let r = p.catch(noop);
        if (c.unsubscribe) {
            c.unsubscribe();
        }
        if (cancelFn) {
            cancelFn(reason);
        }
        if (rejectFn) {
            rejectFn("task cancellation");
        }
        return r;
    }

    if (!isResolved && !isComplete) {
        c.unsubscribe = currentTask.onCompletion(() => {
            p.cancel();
        });
    }
    return p;
}
