import { task } from '../core/tasks';
import { Task, TaskToken } from '../core/types';

/**
 * Cancel all active tasks in the current task context
 * @param reason [optional] a cancellation reason
 * @param includeCurrentTask true if the current task should be also cancelled (default=true)
 * @param olderTasksOnly true if only older tasks should be cancelled (default=true)
 */
export function cancelAll($$:TaskToken, reason?: any, includeCurrentTask = true, olderTasksOnly = true) {
    let currentTask = task($$), g = currentTask.taskGroup;
    if (!g) return;

    let tasks = g.tasks, len = tasks.length, t: Task;
    for (let i = 0; len > i; i++) {
        t = tasks[i];
        if (t === currentTask) {
            if (olderTasksOnly) {
                break;
            }
        } else {
            t.complete("CANCELLED", undefined, reason, currentTask);
        }
    }
    if (includeCurrentTask) {
        // delete last as this will stop the current processing
        currentTask.complete("CANCELLED", undefined, reason, currentTask);
    }
}
