import { Task, TaskToken } from '../core/types';
import { task} from '../core/tasks';

/**
 * Cancel the current task
 * @param reason [optional] a reason explaining why the task is cancelled
 */
export function cancel($$: TaskToken, t?: Task, reason?: string | Error): void;
export function cancel($$: TaskToken, reason?: string | Error): void;
export function cancel($$: TaskToken, taskOrReason?: Task | string | Error, reason?: string | Error) {
    let t: Task | null = null, currentTask = task($$);
    if (taskOrReason) {
        if (taskOrReason["completionStatus"]) {
            t = taskOrReason as Task;
        } else {
            reason = taskOrReason as string | Error;
        }
    }
    t = t || currentTask;
    
    t.complete("CANCELLED", undefined, reason, currentTask);
}
