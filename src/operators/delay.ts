import { promise } from "./promise";
import { TaskToken } from '../core/types';

/**
 * Return a cancellable promise that can be awaited
 * e.g. await delay($$,1000);
 * @param $$ 
 * @param duration the duration (default = 1ms)
 */
export async function delay($$: TaskToken, duration = 1) {
    return promise($$, (resolve, reject, onCancel) => {
        let id = setTimeout(() => resolve(), duration);
        onCancel(() => {
            clearTimeout(id);
        });
    });
}
