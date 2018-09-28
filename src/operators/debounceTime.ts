import { callStackContext } from "./callStackContext";
import { cancel } from "./cancel";
import { delay } from "./delay";
import { Task, TaskToken } from "../core/types";
import { task } from "../core/tasks";

/**
 * Wait for a certain delay and cancel the task if a newer task
 * is created in between
 * @param $$ 
 * @param delay the delay in ms 
 */
export async function debounceTime($$: TaskToken, delayMs: number) {
    let c = callStackContext($$, defaultState);
    if (c.task) {
        // cancel previous task as it has not been released yet
        cancel($$, c.task!);
    }
    c.task = task($$);
    await delay($$, delayMs);
    c.task = null; // cannot be cancelled any more
}

// state factory
function defaultState(): { task: Task | null } {
    return { task: null }
}
