import { task, createTaskGroup, isTask, COMPLETED, ERROR } from './../core/tasks';
import * as assert from 'assert';
import * as sm from "./samples";
import { promise } from '../operators/promise';
import { CANCELLED } from '../core/tasks';

describe("Tasks", () => {

    afterEach(() => {
        if (sm.trace.logs.length > 0) {
            console.log("Log should be empty: ", sm.trace.logs);
        }
        assert.equal(sm.trace.logs.length, 0, "Empty logs");
        sm.trace.reset();
    })

    it("should be created through a TaskContext", function () {
        let tc = createTaskGroup(sm.simpleTaskWithSubTask),
            t1 = tc.processNewTask(1),
            traceStack = [
                "simpleTaskWithSubTask prefix: ''",
                "subTask prefix: '.0'",
                "simpleTask prefix: '.0.0'",
                "value: 22",
                "subTask prefix: '.0.1'",
                "simpleTask prefix: '.0.1.0'",
                "value: 64",
                "subTask prefix: '.0.1.1'",
                "value: 84",
                "value: 94",
                "value: 104",
                "value: 1104"
            ];

        assert.deepEqual(sm.trace.logs, traceStack, "logs ok - 1st time");
        sm.trace.reset();

        let t2 = tc.processNewTask(1);
        assert.deepEqual(sm.trace.logs, traceStack, "logs ok - 2nd time");
        sm.trace.reset();
        assert.equal(t1["context"], null, "t1 is disposed");
        assert.equal(t2["context"], null, "t2 is disposed");
    });

    it("should generate unique ids with loops", function () {
        let c = createTaskGroup(sm.simpleTaskWithLoop),
            t1 = c.processNewTask(4),
            traceStack = [
                "simpleTaskWithLoop prefix: ''",
                "simpleTask prefix: '.0'",
                "value: 28",
                "simpleTask prefix: '.0#1'",
                "value: 96",
                "simpleTask prefix: '.0#2'",
                "value: 232",
                "simpleTask prefix: '.0#3'",
                "value: 504",
                "value: 1514"
            ];

        assert.deepEqual(sm.trace.logs, traceStack, "logs ok - 1st time");
        sm.trace.reset();

        let t2 = c.processNewTask(4);
        assert.deepEqual(sm.trace.logs, traceStack, "logs ok - 2nd time");
        sm.trace.reset();
    });

    it("should be retrieved from task($$)", async function () {
        function foo($$, nbr) {
            let t = task($$);
            if (isTask(t)) {
                return "TASK - " + nbr;
            }
            return "NOT A TASK - " + nbr;
        }

        let c = createTaskGroup(foo),
            r = await c.processNewTask(42).result()

        assert.equal(r, "TASK - 42", "task has been retrieved");

        function foo2($$, nbr) {
            let t = task($$);
            return promise($$, (resolve) => {
                setTimeout(() => {
                    if (isTask(t)) {
                        resolve("TASK - " + nbr);
                    }
                    resolve("NOT A TASK - " + nbr);
                }, 1);
            });
        }
        let c2 = createTaskGroup(foo2),
            r2 = await c2.processNewTask(42).result()

        assert.equal(r2, "TASK - 42", "task has been retrieved (async)");
    });

    it("should support errors in sync task", function () {

        function myTask($$, v) {
            if (v === 2) {
                throw new Error("v cannot be 2");
            }
            return v * 2;
        }

        let c = createTaskGroup(myTask);

        assert.equal(c.processNewTask(1).completionResult, 2, "result is 2");
        let t2 = c.processNewTask(2);
        assert.equal(t2.completionStatus, ERROR, "t2 ended in error");
        assert.equal(t2.completionResult, undefined, "t2 result is undefined");
        assert.equal((t2.cancellationReason as Error)!.message, "v cannot be 2", "error is accessible in cancellationReason");
    });

    async function delay($$, duration = 100) {
        return promise($$, (resolve, reject, onCancel) => {
            let id = setTimeout(() => resolve(), duration);
            onCancel(() => {
                clearTimeout(id)
            });
        });
    }

    it("should support errors in async tasks", async function () {

        async function myTask($$, v) {
            await delay($$, 1);
            if (v === 2) {
                throw new Error("v cannot be 2");
            }
            return v * 2;
        }

        let c = createTaskGroup(myTask), t1 = c.processNewTask(1);
        await t1.result();
        assert.equal(t1.completionResult, 2, "result is 2");

        let t2 = c.processNewTask(2);
        await t2.result();
        assert.equal(t2.completionStatus, ERROR, "t2 ended in error");
        assert.equal(t2.completionResult, undefined, "t2 result is undefined");
        assert.equal((t2.cancellationReason as Error)!.message, "v cannot be 2", "right error message");
    });

    it("should offer subscribeToCompletion on sync tasks", function () {
        let logs: string[] = [];

        function myTask($$, v: number) {
            logs.push("start of task " + v);
            let unsubscribe = task($$).onCompletion(() => {
                logs.push("completion of task " + v);
            })
            if (v % 2) {
                // odd tasks will not be notified
                unsubscribe(); // only even tasks should appear in the logs
            }
            return v;
        }

        let g = createTaskGroup(myTask),
            t1 = g.processNewTask(1),
            t2 = g.processNewTask(2),
            t3 = g.processNewTask(3),
            t4 = g.processNewTask(4);

        assert.equal(g.tasks.length, 0, "all tasks completed");
        assert.deepEqual(logs, [
            "start of task 1",
            "start of task 2",
            "completion of task 2",
            "start of task 3",
            "start of task 4",
            "completion of task 4"
        ], "logs ok");
        assert.equal(t1.completionStatus, COMPLETED, "t1 completion ok");
        assert.equal(t2.completionStatus, COMPLETED, "t2 completion ok");
    });

    it("should offer subscribeToCompletion on async tasks", async function () {
        let logs: string[] = [];

        async function myTask($$, v: number) {
            logs.push("start of task " + v);
            let unsubscribe = task($$).onCompletion(() => {
                logs.push("completion of task " + v);
            })
            if (v % 2) {
                // odd tasks will not be notified
                unsubscribe(); // only even tasks should appear in the logs
            }
            await delay($$, 1);
            return v;
        }

        let g = createTaskGroup(myTask),
            t1 = g.processNewTask(1),
            t2 = g.processNewTask(2),
            t3 = g.processNewTask(3),
            t4 = g.processNewTask(4);

        assert.equal(g.tasks.length, 4, "all tasks pending completion");
        assert.deepEqual(logs, [
            "start of task 1",
            "start of task 2",
            "start of task 3",
            "start of task 4",
        ], "logs ok - 1");

        let r4 = await t4.result();
        assert.equal(r4, 4, "r4 is 4");

        assert.deepEqual(logs, [
            "start of task 1",
            "start of task 2",
            "start of task 3",
            "start of task 4",
            "completion of task 2",
            "completion of task 4"
        ], "logs ok - 2");
        assert.equal(t1.completionStatus, COMPLETED, "t1 completion ok");
        assert.equal(t2.completionStatus, COMPLETED, "t2 completion ok");
    });

    it("should be disposed on taskGroup.dispose()", function () {
        async function myTask($$, v: number) {
            await delay($$, 2000);
            return v * 2;
        }

        let g = createTaskGroup(myTask), t1 = g.processNewTask(1), t2 = g.processNewTask(2);
        assert.equal(g.tasks.length, 2, "2 tasks in group");
        g.dispose();
        assert.equal(g.tasks.length, 0, "no more tasks in group");
        assert.equal(t1.completionStatus, CANCELLED, "t1 cancelled");
        assert.equal(t2.completionStatus, CANCELLED, "t2 cancelled");
        assert.equal(t1.cancellationReason, "task group disposed", "t1 cancelled by group");
    });

});
