import { Message, TaskToken } from '../core/types';
import { callStackContext } from './callStackContext';
import { cancel } from './cancel';

/**
 * Returns a data if the input stream is empty: if the first message passed is a completion message, the default value will be returned.
 * Otherwise:
 * - it the message contains data, the data will be returned
 * - if the message contains an error or is a completion message, the task will be cancelled (so errors have to be handle before calling this operator)
 * @param $$ 
 * @param message 
 * @param defaultValue 
 */
export function defaultIfEmpty<T>($$: TaskToken, message: Message<T>, defaultValue: T): T {
    let c = callStackContext($$, defaultContext);
    if (c.isFirst && message.isCompletion()) {
        c.isFirst = false;
        return defaultValue;
    }
    c.isFirst = false;
    if (message.isData()) {
        return message.data as T;
    }
    cancel($$);
    return defaultValue; // to please TS parser - but will never been reached as task will be cancelled
}

function defaultContext() {
    return { isFirst: true };
}
