import { Subscribable, TaskToken, Observer, PartialObserver, Unsubscribable, DataGenerator, DataTransformer, TaskGroup, Processable, CancellablePromise, Task, Message, MsgTransformer } from './types';
import { createTaskGroup, COMPLETED, ERROR, isTaskRef, task, PROCESSING } from './tasks';
import { CANCELLED } from './tasks';


const OUTPUT_KEY = "$$output", INPUT_KEY = "$$input", CANCELLATION_ERROR = new Error("Cancellation");

function createTaskData(observer, subscription) {
    return { $$output: observer, $$input: subscription }
}

abstract class ProcessableBase<T> implements Processable<T> {
    protected _parentTask: Task | null = null;

    pipe<R>(f: ($$: TaskToken, value: T, output: Observer<R>, input: Unsubscribable) => void): Processable<R> {
        return new Subject<T, R>(this, f);
    }

    forEach<R>(f: ($$: TaskToken, value: T, output: Observer<R>, input: Unsubscribable) => void): CancellablePromise<void> {
        return this._forEach(f, false);
    }

    process<R>(f: ($$: TaskToken, message: Message<T>, output: Observer<R>, input: Unsubscribable) => void): Processable<R> {
        return new Subject<T, R>(this, f, true);
    }

    processEach<R>(f: ($$: TaskToken, message: Message<T>, output: Observer<R>, input: Unsubscribable) => void): CancellablePromise<void> {
        return this._forEach(f, true);
    }

    private _forEach<R>(f: ($$: TaskToken, value: T | Message<T>, output: Observer<R>, input: Unsubscribable) => void, useMessages: boolean): CancellablePromise<void> {

        let subject = new Subject<T, R>(this, f, useMessages),
            subscription: Unsubscribable,
            rejectFn: (reason?) => void,
            cancelResult,
            p = new Promise((resolve, reject) => {
                subscription = subject.subscribe(
                    undefined,
                    (e: any) => { subscription.unsubscribe(); reject(e) },
                    () => { subscription.unsubscribe(); resolve(); });
                rejectFn = reject;
            }) as CancellablePromise<void>;
        p.cancel = (reason?: any) => {
            if (!cancelResult) {
                reason = reason || new Error("subscription cancellation");
                if (typeof reason === "string") {
                    reason = new Error(reason);
                }
                cancelResult = p.catch(noop);
                subscription.unsubscribe();
                rejectFn(reason);
            }
            return cancelResult;
        }
        if (this._parentTask) {
            this._parentTask.onCompletion(() => {
                p.cancel();
            });
        }
        return p;
    }

    subscribe(observer?: PartialObserver<T>): Unsubscribable;
    subscribe(next?: (value: T) => void, error?: (error: any) => void, complete?: () => void): Unsubscribable;
    subscribe(observerOrNext?: PartialObserver<T> | ((value: T) => void),
        error?: (error: any) => void,
        complete?: () => void): Unsubscribable {
        // implementation should be overridden by child classes
        return { unsubscribe: noop }
    }
}

/**
 * Return the output observer associated to the current task
 * @param $$ 
 */
export function output<T>($$: TaskToken): Observer<T> {
    return task($$).data![OUTPUT_KEY];
}

/**
 * Return the input subscription associated to the current task
 * @param $$ 
 */
export function input($$: TaskToken): Unsubscribable {
    return task($$).data![INPUT_KEY];
}

export function noop() { };

/**
 * A representation of any set of values over any amount of time. (cf. RxJS)
 * Generate a cold Observable.
 *
 * @class Observable<T>
 */
export class Observable<T> extends ProcessableBase<T>  {
    private _dataGenerator: DataGenerator<T>;

    /**
     * @constructor
     * @param {DataGenerator<T>} dataGenerator the function that is called to generate the output stream
     * when the Observable is subscribed to. This function is given an Observer, to which new values
     * can be `next`ed, or an `error` method can be called to raise an error, or
     * `complete` can be called to notify of a successful completion.
     */
    constructor($$: TaskToken | null, dataGenerator: DataGenerator<T>);
    constructor(dataGenerator: DataGenerator<T>);
    constructor($$OrDataGenerator: TaskToken | null | DataGenerator<T>, dataGenerator?: DataGenerator<T>) {
        super();
        if (isTaskRef($$OrDataGenerator)) {
            let $$ = $$OrDataGenerator as TaskToken;
            this._parentTask = task($$);
            this._dataGenerator = dataGenerator!;
        } else if ($$OrDataGenerator === null) {
            this._dataGenerator = dataGenerator!;
        } else {
            this._dataGenerator = $$OrDataGenerator as DataGenerator<T>;
        }
        if (!this._dataGenerator) {
            throw new Error("Observable: dataGenerator must be provided in constructor");
        }
    }

    subscribe(observerOrNext?: PartialObserver<T> | ((value: T) => void),
        error?: (error: any) => void,
        complete?: () => void): Unsubscribable {

        // create observer wrapper
        let observer = new Subscriber(observerOrNext, error, complete),
            subscription = {} as Unsubscribable;

        // create task group to run the data generator 
        let g = createTaskGroup(async ($$) => {
            await Promise.resolve(); // run the generation asynchronously
            await this._dataGenerator($$, observer, subscription);
        });

        let t = g.processNewTaskWithContext([observer, subscription], createTaskData(observer, subscription));

        if (this._parentTask) {
            let pt = this._parentTask;
            pt.onCompletion(() => {
                if (pt.completionStatus === "CANCELLED") {
                    cancelGroupTasks(g, pt.cancellationReason);
                }
                observer.close();
            });
        }

        // if data generator calls complete, we end the task
        observer.onCompletion = () => {
            t.complete(COMPLETED);
        }

        if (t.completionStatus !== PROCESSING) {
            observer.complete();
            g.dispose();
        } else {
            // if tasks completes, send the complete signal (if not already done)
            t.onCompletion(() => {
                if (t.completionStatus === ERROR) {
                    observer.error(t.cancellationReason);
                } else if (t.completionStatus === CANCELLED) {
                    observer.error(CANCELLATION_ERROR);
                }
                observer.complete();
                g.dispose();
            });
        }

        subscription.unsubscribe = () => {
            observer.close();
            t.complete(CANCELLED, undefined, "Observable: data generator unsubscribed");
        }

        return subscription;
    }
}

function cancelGroupTasks(g: TaskGroup, reason?: any) {
    let tasks = g.tasks, idx = tasks.length;
    while (idx--) {
        tasks[idx].complete("CANCELLED", undefined, reason);
    }
}

class Subscriber<T> implements Observer<T> {
    closed = false;
    onCompletion: (() => void) | null = null;
    _observer: PartialObserver<T> | null = null;
    _next: ((value: T) => void) | null = null;
    _error: ((e: any) => void) | null = null;
    _complete: (() => void) | null = null;

    constructor(observerOrNext?: PartialObserver<T> | ((value: T) => void),
        error?: (e: any) => void,
        complete?: () => void) {

        if (typeof observerOrNext === "function") {
            this._next = observerOrNext;
        } else {
            this._observer = observerOrNext as PartialObserver<T>;
        }

        this._error = error || null;
        this._complete = complete || null;
    }

    next(value: T): void {
        if (!this.closed) {
            if (this._next) {
                this._next(value);
            } else {
                let o = this._observer;
                if (o && o.next) {
                    o.next(value);
                }
            }
        }
    };

    error(e: any): void {
        // send error (but don't complete)
        if (!this.closed) {
            if (e === CANCELLATION_ERROR) {
                let o = this._observer;
                if (o && o["cancel"]) {
                    o["cancel"](); // Value Observer has a cancel method to cancel sub-tasks
                }
            } else if (this._error) {
                this._error(e);
            } else {
                let o = this._observer;
                if (o && o.error) {
                    o.error(e);
                }
            }
        }
    };

    close() {
        // called when the observer unsubscribes to prevent sending more messages
        this.closed = true;
    }

    complete(): void {
        if (!this.closed) {
            this.closed = true;

            // send complete
            if (this._complete) {
                this._complete();
            } else {
                let o = this._observer;
                if (o && o.complete) {
                    o.complete();
                }
            }

            if (this.onCompletion) {
                this.onCompletion();
                this.onCompletion = null;
            }
        }
    };
}

class Subject<T, R> extends ProcessableBase<R> {
    private _taskFunction: DataTransformer<T, R> | MsgTransformer<T, R>;
    private _source: Subscribable<T>;

    constructor(source: Processable<T>, dataTransformer: DataTransformer<T, R> | MsgTransformer<T, R>, protected _useMessages = false) {
        super();
        this._taskFunction = dataTransformer;
        this._source = source;
    }

    subscribe(observerOrNext?: PartialObserver<R> | ((value: R) => void),
        error?: (error: any) => void,
        complete?: () => void): Unsubscribable {
        // create observer wrapper
        let o = new Subscriber(observerOrNext, error, complete);

        // create task group
        let g = createTaskGroup(this._taskFunction);

        // create source observer
        if (this._useMessages) {
            return new MsgObserver(g, o, this._source);
        } else {
            return new ValueObserver(g, o, this._source);
        }
    }
}

class ValueObserver<T> implements Observer<T> {
    protected _subscription: Unsubscribable;
    protected _completeSent = false;
    closed = false;

    constructor(protected _taskGroup: TaskGroup, protected _observer: Subscriber<any>, source: Subscribable<T>) {
        this._subscription = source.subscribe(this);
        _observer.onCompletion = () => {
            this.unsubscribe();
        }
    }

    unsubscribe() {
        this._subscription.unsubscribe();
        this._sendCompleteWhenAllDone();
    }

    next(value: T): void {
        if (!this.closed) {
            let o = this._observer, i = this;
            this._taskGroup.processNewTaskWithContext([value, o, i], createTaskData(o, i));
        }
    }

    close() {
        // called when the observer unsubscribes to prevent sending more messages
        this.closed = true;
    }

    cancel() {
        cancelGroupTasks(this._taskGroup);
    }

    error(e: any): void {
        // send error (but don't complete)
        if (!this.closed) {
            this._observer.error(e);
        }
    };

    complete(): void {
        if (!this.closed) {
            this.close();
            this._sendCompleteWhenAllDone();
        }
    }

    protected async _complete() {
        if (!this._completeSent) {
            this._completeSent = true;
            this._observer.complete();
        }
    }

    private _sendCompleteWhenAllDone() {
        let g = this._taskGroup;
        if (g.tasks.length === 0) {
            this._complete();
        } else {
            g.onTaskCompletion = () => {
                if (g.tasks.length === 0) {
                    this._complete();
                    g.onTaskCompletion = null;
                    this._observer.close();
                    g.dispose();
                }
            }
        }
    }
}

class MsgObserver<T> extends ValueObserver<T> {
    _sendMessage(type: "DATA" | "ERROR" | "COMPLETION", content?: Error | T) {
        if (!this.closed || type === "COMPLETION") {
            let o = this._observer, i = this, m = new Msg<T>(type, content);
            this._taskGroup.processNewTaskWithContext([m, o, i], createTaskData(o, i));
        }
    }

    next(value: T): void {
        this._sendMessage("DATA", value);
    }

    error(e: any): void {
        this._sendMessage("ERROR", e);
    };

    protected async _complete() {
        if (!this._completeSent) {
            this._completeSent = true;
            await this._sendMessage("COMPLETION");
            this._observer.complete();
        }
    }
}

class Msg<T> implements Message<T> {
    readonly error?: Error;
    readonly data?: T;

    constructor(private _type: "DATA" | "ERROR" | "COMPLETION", content?: Error | T) {
        if (_type === "ERROR") {
            this.error = content as Error;
        } else if (_type === "DATA") {
            this.data = content as T;
        }
    }

    get type() {
        return this._type;
    }
    isData() {
        return this._type === "DATA";
    }
    isError() {
        return this._type === "ERROR";
    }
    isCompletion() {
        return this._type === "COMPLETION";
    }
}
