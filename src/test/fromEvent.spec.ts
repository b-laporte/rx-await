import * as assert from 'assert';
import { HasEventTargetAddRemove, fromEvent } from '../sources/fromEvent';
import { TestObserver } from './testObserver';

describe("fromEvent", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    class EvtEmitter implements HasEventTargetAddRemove<number> {
        listeners: any[] = [];
        onSubscription: () => void;

        addEventListener(type: string, listener: ((evt: number) => void) | null, options?: boolean | AddEventListenerOptions): void {
            this.listeners.push(listener);
            if (this.onSubscription) this.onSubscription();
        }
        removeEventListener(type: string, listener?: ((evt: number) => void) | null, options?: EventListenerOptions | boolean): void {
            let idx = this.listeners.indexOf(listener);
            if (idx > -1) {
                this.listeners.splice(idx, 1);
            }
        }
        emit(v: number) {
            for (let i = 0, len = this.listeners.length; len > i; i++) {
                this.listeners[i](v);
            }
        }
    }

    it("should work", async function () {
        let ee = new EvtEmitter(),
            obs = new TestObserver(logs, "obs");

        ee.onSubscription = () => {
            ee.emit(3);
            ee.emit(1);
            ee.emit(42);
        }
        let p = fromEvent(ee, "foo").pipe(($$, v, output) => {
            logs.push("evt value:" + v);
            if (v === 42) {
                output.complete();
            }
        });

        assert.equal(ee.listeners.length, 0, "no listeners");
        p.subscribe(obs);

        await obs.completion();

        assert.deepEqual(logs, ['evt value:3', 'evt value:1', 'evt value:42', 'obs: complete()'], "logs ok");
    });

    it("should remove listener if forEach promise is cancelled", async function () {
        let ee = new EvtEmitter();

        ee.onSubscription = () => {
            ee.emit(1);
            ee.emit(2);
        }
        assert.equal(ee.listeners.length, 0, "no listeners");
        let nbrOfListeners = -1;

        let p = fromEvent(ee, "foo").pipe(($$, v, output) => {
            nbrOfListeners = ee.listeners.length;
            output.next(v);
            if (v === 1) {
                p.cancel();
            }
        }).forEach(($$, v, output) => {
            logs.push("evt value:" + v);
        });
        await p;
        assert.equal(nbrOfListeners, 1, "one listener during execution");
        assert.equal(ee.listeners.length, 0, "no more listeners");
    });

});
