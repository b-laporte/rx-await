
import { TaskGroup, TaskFunction, TaskToken, Task, TaskCompletionStatus, CancellablePromise, UnsubscribeFunction } from './types';

export const TASK = "task", STACK_ID = "stackId", ERROR = "ERROR", CANCELLED = "CANCELLED", COMPLETED = "COMPLETED", PROCESSING = "PROCESSING", CANCEL_EXCEPTION = {}

/**
 * Return the task object associated to a given task function call
 * @param $$ the task symbol (i.e. $$)
 */
export function task($$: TaskToken): Task {
    return $$[TASK] as Task;
}

// Generate a function that will be passed as $$ argument to task functions
function taskToken(t: TaskImpl, id: string): TaskToken {
    function tt(index) {
        let newId = id + "." + index, idIdx = t._locatorIndices[newId];
        if (idIdx) {
            t._locatorIndices[newId] = idIdx + 1;
            newId += "#" + idIdx;
        } else {
            t._locatorIndices[newId] = 1;
        }
        return taskToken(t, newId);
    }
    tt[TASK] = t;
    tt[STACK_ID] = id;
    return <any>tt as TaskToken;
}

export function isTaskRef($$: any): boolean {
    return ($$ && $$[TASK] !== undefined && $$[STACK_ID] !== undefined);
}

/**
 * Create a task context associated to the current task function
 * @param f 
 */
export function createTaskGroup(f: TaskFunction): TaskGroup {
    return new TaskContext(f);
}

/**
 * Context gathering all task instances associated for a given task function context
 * Task linked list gathering all tasks running in the same context
 */
class TaskContext implements TaskGroup {
    private _taskFunction: TaskFunction;
    private _tasks: Task[] = [];
    private _taskData: object;
    onTaskCompletion: ((t: Task) => void) | null = null;

    constructor(f: TaskFunction) {
        this._taskFunction = f;
        this._taskData = {};
    }

    // return a copy of the tasks array
    get tasks() {
        return this._tasks.slice(0);
    }

    processNewTask(...values: any[]): Task {
        return this.processNewTaskWithContext(values, null);
    }

    processNewTaskWithContext(args: any[], data: any): Task {
        let t = new TaskImpl(this), r, argCount = args.length;
        t.data = data;
        this._tasks.push(t);

        try {
            if (argCount === 0) {
                r = this._taskFunction(taskToken(t, ""));
            } else if (argCount === 3) {
                // most frequent case with observables: value, output, input
                r = this._taskFunction(taskToken(t, ""), args[0], args[1], args[2]);
            } else {
                let args2 = args.slice(0);
                args2.splice(0, 0, taskToken(t, ""));
                r = this._taskFunction.apply(null, args2);
            }
            t._processingResult = r;
        } catch (ex) {
            t._processingResult = t._cpResult = undefined;
            t.complete(ERROR, undefined, ex);
        }

        if (r && r.then) {
            // asynchronous task
            t._processingResult = r.then((value) => {
                if (t._cpStatus === PROCESSING) {
                    t.complete(COMPLETED, value);
                    return value;
                }
                return undefined;
            }, (ex) => {
                t._cpResult = undefined;
                t.complete(ERROR, undefined, ex);
                return undefined;
            });
        } else {
            // synchronous task
            t.complete(COMPLETED, r);
        }

        return t;
    }

    callStackContext<T>(stackId, contextFactory: () => T): T {
        let d = this._taskData[stackId];
        if (!d) {
            d = this._taskData[stackId] = contextFactory();
        }
        return d;
    }

    dispose() {
        let tasks = this.tasks, i = tasks.length;
        while (i--) {
            tasks[i].complete(CANCELLED, undefined, "task group disposed");
        }
        this._tasks = [];
        this._taskData = {};
    }

    removeTask(t: Task) {
        let idx = this._tasks.indexOf(t);
        if (idx > -1) {
            this._tasks.splice(idx, 1);
            if (this.onTaskCompletion) {
                this.onTaskCompletion(t);
            }
            (t as TaskImpl).dispose();
        }
    }
}

export function createTask(): Task {
    return new TaskImpl();
}

let TASK_COUNT = 0;
class TaskImpl implements Task {
    _id: number;
    _context: TaskContext | null = null;
    _processingResult: any;
    _locatorIndices: object;
    _cpStatus: TaskCompletionStatus = PROCESSING;
    _cpResult: any = undefined;
    _cnReason: Error | string = "";
    _endSubscriptions: Function[] | null = null;
    data: any;

    constructor(context?: TaskContext) {
        this._id = TASK_COUNT++;
        this._context = context || null;
        this._locatorIndices = {};
        this._processingResult = undefined;
    }

    get id() {
        return this._id;
    }

    get completionStatus(): TaskCompletionStatus {
        return this._cpStatus;
    }

    get cancellationReason(): any {
        return this._cnReason;
    }

    get completionResult(): any {
        return this._cpResult;
    }

    isComplete() {
        return this._cpStatus !== PROCESSING;
    }

    get taskGroup() {
        return this._context;
    }

    async result(): Promise<any> {
        let pr = this._processingResult;
        if (this.isComplete()) {
            return this.completionResult;
        } else if (pr && pr.then) {
            let r = await pr;
            this.dispose();
            return r;
        }
        return this._processingResult;
    }

    onCompletion(callback: Function): UnsubscribeFunction {
        let es = this._endSubscriptions = this._endSubscriptions || [];
        es.push(callback);
        return function () {
            let idx = es.indexOf(callback);
            if (idx > -1) {
                es.splice(idx, 1);
            }
        }
    }

    complete(status: "COMPLETED" | "CANCELLED" | "ERROR", result: any, reason: Error | string = "", currentTask?: Task) {
        if (this._cpStatus === PROCESSING) {
            this._cpStatus = status;
            this._cpResult = result;
            this._cnReason = reason;

            this.dispose();

            if (currentTask && (this === currentTask || currentTask.completionStatus === CANCELLED)) {
                // if currentTask.completionStatus === CANCELLED the current task is a child of this
                throw CANCEL_EXCEPTION;
            }
        }
    }

    dispose() {
        if (this._context) {
            this._context.removeTask(this);
        }
        if (this._endSubscriptions) {
            let es = this._endSubscriptions;
            for (let i = 0, len = es.length; len > i; i++) {
                es[i]();
            }
            this._endSubscriptions = null;
        }
        this._context = null;
    }
}

export function isTask(o: Object) {
    return o.constructor === TaskImpl;
}
