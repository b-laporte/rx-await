import { task } from '../core/tasks';
import { callStackContext } from './callStackContext';
import { Task, TaskToken } from '../core/types';
import { cancel } from './cancel';

/**
 * Cancel future tasks as long as the task that created the lock is not completed
 * @param $$ 
 */
export function lock($$: TaskToken) {
    let c = callStackContext($$, defaultState)
    if (!c.task) {
        // store the current task in the context
        let t = task($$);
        c.task = t;
        t.onCompletion(() => {
            c.task = null; // free context for new tasks
        })
    } else {
        cancel($$);
    }
}

function defaultState(): { task: Task | null } {
    return { task: null }
}
