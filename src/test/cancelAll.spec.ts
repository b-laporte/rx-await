import * as assert from 'assert';
import { createTaskGroup, CANCELLED, COMPLETED } from '../core/tasks';
import { cancelAll } from '../operators/cancelAll';
import { delay } from '../operators/delay';

describe("cancelAll", () => {

    it("should support cancelAll(reason, true, true)", async function () {
        let logs: string[] = [];

        async function cancelTest($$, v) {
            if (v === 42) {
                // cancel all, including the current task, but not more recent tasks
                cancelAll($$, "cancel test 42");
            }
            logs.push(v + "-A");
            await delay($$, 2000); // 10000 wil stop mocha if not cancelled
            logs.push(v + "-B");
            return v * 2;
        }

        let g = createTaskGroup(cancelTest),
            t1 = g.processNewTask(1),
            t2 = g.processNewTask(2);
        assert.equal(g.tasks.length, 2, "2 tasks in g");
        assert.equal(g.tasks[0], t1, "t1 is first");
        assert.equal(g.tasks[1], t2, "t2 is second");

        assert.deepEqual(logs, [
            "1-A",
            "2-A"
        ], "logs ok");

        let t42 = g.processNewTask(42);
        await t42.result();
        assert.equal(g.tasks.length, 0, "no more tasks in g");

        assert.equal(t1.completionStatus, CANCELLED, "t1 was cancelled");
        assert.equal(t2.completionStatus, CANCELLED, "t2 was cancelled");
        assert.equal(t42.completionStatus, CANCELLED, "t42 was cancelled");
        assert.equal(t42.completionResult, undefined, "t42 has no result");
        assert.equal(t1.cancellationReason, "cancel test 42", "t1 has cancellation reason");
        assert.equal(t42.cancellationReason, "cancel test 42", "t42 has cancellation reason");

        assert.deepEqual(logs, [
            "1-A",
            "2-A"
        ], "logs ok");
    });

    it("should support cancelAll(reason, false, true)", async function () {
        let logs: string[] = [];

        async function cancelTest($$, v) {
            if (v === 42) {
                // cancel all, except the current task and the newer tasks
                await delay($$, 1);
                cancelAll($$, "cancel test 42", false);
            }
            logs.push(v + "-A");
            await delay($$, v === 42 ? 1 : 10);
            logs.push(v + "-B");
            return v * 2;
        }

        let g = createTaskGroup(cancelTest),
            t1 = g.processNewTask(1),
            t2 = g.processNewTask(2);
        assert.equal(g.tasks.length, 2, "2 tasks in g");
        assert.equal(g.tasks[0], t1, "t1 is first");
        assert.equal(g.tasks[1], t2, "t2 is second");

        assert.deepEqual(logs, [
            "1-A",
            "2-A"
        ], "logs ok");

        let t42 = g.processNewTask(42), t3 = g.processNewTask(3);
        await t42.result();
        assert.equal(g.tasks.length, 1, "1 task in g");
        assert.equal(g.tasks[0], t3, "t3 is first task");
        assert.equal(t42.completionStatus, COMPLETED, "t42 was not cancelled");
        assert.equal(t42.completionResult, 84, "result is 84");

        await t3.result();
        assert.deepEqual(logs, [
            "1-A",
            "2-A",
            "3-A",
            "42-A",
            "42-B",
            "3-B"
        ], "logs ok (2)");
    });

    it("should support cancelAll(reason, false, false)", async function () {
        let logs: string[] = [];

        async function cancelTest($$, v) {
            if (v === 42) {
                // cancel all, including the newer tasks, except the current task
                await delay($$, 1);
                cancelAll($$, "cancel test 42", false, false);
            }
            logs.push(v + "-A");
            await delay($$, v === 42 ? 1 : 10);
            logs.push(v + "-B");
            return v * 2;
        }

        let g = createTaskGroup(cancelTest),
            t1 = g.processNewTask(1),
            t2 = g.processNewTask(2);
        assert.equal(g.tasks.length, 2, "2 tasks in g");
        assert.equal(g.tasks[0], t1, "t1 is first");
        assert.equal(g.tasks[1], t2, "t2 is second");

        assert.deepEqual(logs, [
            "1-A",
            "2-A"
        ], "logs ok");

        let t42 = g.processNewTask(42), t3 = g.processNewTask(3);
        await t42.result();
        assert.equal(g.tasks.length, 0, "no more tasks in g");
        assert.equal(t42.completionStatus, COMPLETED, "t42 was not cancelled");
        assert.equal(t42.completionResult, 84, "result is 84");
        assert.equal(t3.completionStatus, CANCELLED, "t3 cancelled");
        assert.equal(t3.cancellationReason, "cancel test 42", "t3 cancellation reason");

        assert.deepEqual(logs, [
            "1-A",
            "2-A",
            "3-A",
            "42-A",
            "42-B"
        ], "logs ok (2)");
    });


});