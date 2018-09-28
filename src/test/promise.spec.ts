import * as assert from 'assert';
import { createTaskGroup, task, PROCESSING, CANCELLED, ERROR, COMPLETED } from '../core/tasks';
import { promise } from '../operators/promise';
import { cancel } from '../operators/cancel';
import { Task } from '../core/types';

describe("promise", () => {

    it("should generate promises", async function () {
        async function test($$, v) {
            let p = promise($$, (resolve, reject) => {
                if (v === 1) {
                    resolve(1);
                } else {
                    reject(2);
                }
            });

            return p.then((v) => "OK: " + v, (e) => "KO: " + v);
        }

        let g = createTaskGroup(test), t1 = g.processNewTask(1), r1 = t1.result();

        assert.equal(r1 instanceof Promise, true, "t1 generated a promise");
        r1 = await r1;
        assert.equal(t1.completionStatus, COMPLETED, "t1 completed successfully");
        assert.equal(r1, "OK: 1", "successful result");

        let t2 = g.processNewTask(2), r2 = await t2.result()

        assert.equal(t2.completionStatus, COMPLETED, "t2 completed successfully");
        assert.equal(r2, "KO: 2", "r2 as expected");
    });

    it('should generate cancellable promises', async function () {
        let cancelCounter = 0, lastTask: Task | null = null, err = new Error("Cancellation Error");
        async function delay($$, v) {
            if (!lastTask) {
                lastTask = task($$);
            } else {
                if (v == 42) {
                    cancel($$, lastTask, err);
                } else {
                    cancel($$, lastTask, "cancellation test");
                }
                lastTask = null;
                return v;
            }
            return promise($$, (resolve, reject, onCancel) => {
                let id = setTimeout(() => {
                    resolve(v);
                }, 10000); // timer is very high - test will go in timeout if cancel doesn't work
                onCancel(() => {
                    cancelCounter++;
                    clearTimeout(id);
                });
            });
        }

        let g = createTaskGroup(delay), t1 = g.processNewTask(1);

        assert.equal(g.tasks.length, 1, "one task in the pipe");
        assert.equal(t1["_endSubscriptions"].length, 1, "1 cancellable promise in t1");
        assert.equal(cancelCounter, 0, "cancelCounter = 0");

        let t2 = g.processNewTask(2); // will trigger t1 cancellation
        let r2 = t2.result();
        let r1 = await t1.result();
        assert.equal(cancelCounter, 1, "cancelCounter = 1");
        assert.equal(t1.completionStatus, CANCELLED, "t1 cancelled");
        assert.equal(r1, undefined, "r1 is undefined");
        assert.equal(t1.cancellationReason, "cancellation test", "t1 cancellation reason ok")

        await r2;
        assert.equal(g.tasks.length, 0, "no more tasks");

        let t41 = g.processNewTask(41), t42 = g.processNewTask(42);

        let r41 = await t41.result();
        assert.equal(cancelCounter, 2, "cancelCounter = 2");


        assert.equal(t41.completionStatus, CANCELLED, "t41 cancelled");
        assert.equal(r41, undefined, "r41 is undefined");
        assert.equal(t41.cancellationReason, err, "t41 cancellation reason is an error")

        await t42.result();
        assert.equal(g.tasks.length, 0, "no more tasks - 2");
        assert.equal(cancelCounter, 2, "cancelCounter = 2 (2)");
        assert.equal(lastTask, null, "lastTask is null");
    });

});
