import { STACK_ID, task } from '../core/tasks';
import { TaskToken } from '../core/types';

/**
 * Create and store a persisting context object that will be associated to the current logical call stack
 * If another task calls the same function in the same logical call stack, then the previous context will be returned
 * @param $$ 
 * @param stateFactory A factory function to generate the initial state object (will only be called if the state doesn't exist)
 */
export function callStackContext<T>($$: TaskToken, stateFactory: () => T): T {
    // context is a hidden property as it shouldn't be used directly
    let t = task($$), stackId = $$[STACK_ID], group = t.taskGroup;
    if (!group) {
        throw new Error("callStackContext cannot be called on a completed task");
    }
    return (group as any).callStackContext(stackId, stateFactory); // todo
}
