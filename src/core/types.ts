import { Unsubscribable } from './types';

// #######################################################################################################################################
// Tasks

export interface TaskToken {
    task: Task;
    stackId: string;
}

export interface TaskFunction {
    ($$: TaskToken, ...args: any[]): any;
}

export interface CancellablePromise<T> extends Promise<T> {
    cancel(reason?): Promise<void>;
}

export interface UnsubscribeFunction {
    (): void;
}

export type TaskCompletionStatus = "COMPLETED" | "CANCELLED" | "ERROR" | "PROCESSING";

export interface TaskGroup {
    tasks: Task[];
    processNewTask(...values: any[]): Task;
    processNewTaskWithContext(taskArguments: any[], contextData: any): Task;
    dispose(): void;
    onTaskCompletion: ((t: Task) => void) | null;
}

export interface Task {
    id: number;
    completionStatus: TaskCompletionStatus;
    completionResult: any;
    cancellationReason: Error | string;
    taskGroup: TaskGroup | null;
    data: any;
    isComplete(): boolean;

    /**
     * Set the task in completion state
     * @param status the desired completion status 
     * @param result the result of the task processing
     * @param reason [optional] cancellation reason
     * @param currentTask [optional] task that triggers the completion request (if the current task is being completed, an internal exception will be triggered)
     */
    complete(status: "COMPLETED" | "CANCELLED" | "ERROR", result?: any, reason?: Error | string, currentTask?: Task): void;

    /**
     * Return the result of the processing performed by the task
     */
    result(): Promise<any>;

    /**
     * Allows to be notified when the tasks completes
     * @param callback the callback to call on task completion
     * @return a function to call to unsubscribe before completion
     */
    onCompletion(callback: Function): UnsubscribeFunction;
}

// #######################################################################################################################################
// Observable
export interface Unsubscribable {
    unsubscribe(): void;
}

export interface Subscribable<T> {
    subscribe(observer?: PartialObserver<T>): Unsubscribable;
    subscribe(next?: (value: T) => void, error?: (error: any) => void, complete?: () => void): Unsubscribable;
}

export interface NextObserver<T> {
    closed?: boolean;
    next: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
}

export interface ErrorObserver<T> {
    closed?: boolean;
    next?: (value: T) => void;
    error: (err: any) => void;
    complete?: () => void;
}

export interface CompletionObserver<T> {
    closed?: boolean;
    next?: (value: T) => void;
    error?: (err: any) => void;
    complete: () => void;
}

export type PartialObserver<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;

export interface Observer<T> {
    closed?: boolean;
    next: (value: T) => void;
    error: (err: any) => void;
    complete: () => void;
}

// #######################################################################################################################################
// RxAwait

export type DataGenerator<T> = ($$: TaskToken, output: Observer<T>, input: Unsubscribable) => void;

export type DataTransformer<T, R> = ($$: TaskToken, value: T, output: Observer<R>, input: Unsubscribable) => void;

export type MsgTransformer<T, R> = ($$: TaskToken, message: Message<T>, output: Observer<R>, input: Unsubscribable) => void;

export interface Processable<T> extends Subscribable<T> {
    pipe<R>(f: ($$: TaskToken, value: T, output: Observer<R>, input: Unsubscribable) => void): Processable<R>;
    process<R>(f: ($$: TaskToken, message: Message<T>, output: Observer<R>, input: Unsubscribable) => void): Processable<R>;

    forEach<R>(f: ($$: TaskToken, value: T, output: Observer<R>, input: Unsubscribable) => void): CancellablePromise<void>;
    processEach<R>(f: ($$: TaskToken, message: Message<T>, output: Observer<R>, input: Unsubscribable) => void): CancellablePromise<void>;
}

export interface Message<T> {
    readonly type: "DATA" | "ERROR" | "COMPLETION";
    isData(): boolean;
    isError(): boolean;
    isCompletion(): boolean;
    readonly data?: T;
    readonly error?: Error;
}
