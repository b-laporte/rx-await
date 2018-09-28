import { callStackContext } from './callStackContext';
import { cancel } from './cancel';
import { TaskToken } from '../core/types';

/**
 * Cancel the current task if the value is not distinct from the previous call
 * @param $$ 
 * @param value the value to check
 */
export function distinctUntilChanged($$: TaskToken, value: any) {
    let c = callStackContext($$, defaultState);
    if (!c.firstTime && c.value === value) {
        cancel($$, "distinctUntilChanged: identical value");
    } else {
        c.firstTime = false;
        c.value = value;
    }
}

function defaultState() {
    return { value: undefined, firstTime: true };
}
