import { TaskToken } from './../core/types';
import { Observable } from '../core/observable';
import { isTaskRef, task } from '../core/tasks';
import { promise } from '../operators/promise';

export interface HasEventTargetAddRemove<E> {
    addEventListener(type: string, listener: ((evt: E) => void) | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener?: ((evt: E) => void) | null, options?: EventListenerOptions | boolean): void;
}
export type EventTargetLike<T> = HasEventTargetAddRemove<T>; // | NodeStyleEventEmitter | NodeCompatibleEventEmitter | JQueryStyleEventEmitter
export type FromEventTarget<T> = EventTargetLike<T>; // ArrayLike<EventTargetLike<T>>

/**
 * Create an event stream from events emitted by the event target
 * @param target the event source - e.g. a div Element
 * @param eventName the event name - e.g. "click"
 */
export function fromEvent<T>(target: FromEventTarget<T>, eventName: string): Observable<T>;
/**
 * Create an event stream from events emitted by the event target
 * If the parent task completes, the function will automatically unsubscribe to the event emitter
 * @param $$
 * @param target the event source - e.g. a div Element
 * @param eventName the event name - e.g. "click"
 */
export function fromEvent<T>($$: TaskToken, target: FromEventTarget<T>, eventName: string): Observable<T>;
export function fromEvent<T>($$OrTarget: TaskToken | FromEventTarget<T>, targetOrEventName: FromEventTarget<T> | string, eventName = "click"): Observable<T> {
    let target: FromEventTarget<T>, $$: TaskToken | null = null;

    if (isTaskRef($$OrTarget)) {
        $$ = $$OrTarget! as TaskToken;
        target = targetOrEventName as FromEventTarget<T>;
    } else {
        target = $$OrTarget as FromEventTarget<T>;
        eventName = targetOrEventName as string;
    }

    return new Observable<T>($$, ($$, output) => {
        return promise($$, (resolve, reject, onCancel) => {
            function outputEvent(evt: T) {
                output.next(evt);
            }
            onCancel(() => {
                target.removeEventListener(eventName!, outputEvent);
            });

            // register on event as soon as possible
            Promise.resolve().then(()=>target.addEventListener(eventName, outputEvent));
        });
    });
}
