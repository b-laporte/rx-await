import * as assert from 'assert';
import { createTaskGroup, task } from '../core/tasks';
import { cancel } from '../operators/cancel';
import { callStackContext } from '../operators/callStackContext';
import { Task } from '../core/types';

describe("cancelTask", () => {

    it("should be supported on the current task", function () {

        function test($$, v) {
            if (v === 3) {
                cancel($$, "test cancellation");
            }
            return v * 2;
        }

        let tc = createTaskGroup(test), t1 = tc.processNewTask(1), t2 = tc.processNewTask(2), t3 = tc.processNewTask(3);

        assert.equal(tc.tasks.length, 0, "all tasks have been disposed");
        assert.equal(t1.completionStatus, "COMPLETED", "t1 completed");
        assert.equal(t1.completionResult, 2, "t1 returned 2");
        assert.equal(t2.completionStatus, "COMPLETED", "t2 completed");
        assert.equal(t2.completionResult, 4, "t2 returned 4");
        assert.equal(t3.completionStatus, "CANCELLED", "t3 cancelled");
        assert.equal(t3.completionResult, undefined, "t3 returned undefined");
        assert.equal(t3.cancellationReason, "test cancellation", "t3 cancellation reason ok");
    });

    it("should be supported on a different task", async function () {
        async function delay(timeMs = 10) {
            // note: this promise will not be cancelled - the promise($$) operator should be used instead
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, timeMs);
            });
        }

        async function test($$, v) {
            let c = callStackContext($$, (): { task?: Task } => ({ task: undefined }));
            if (v == 1) {
                c.task = task($$);
                await delay(10);
            }
            if (v === 2) {
                // cancel the previous task
                if (c.task) {
                    cancel($$, c.task, "test cancellation 2");
                }
            }
            return v * 2;
        }

        let tc = createTaskGroup(test), t1 = tc.processNewTask(1), t2 = tc.processNewTask(2);
        assert.equal(tc.tasks.length, 1, "1 task pending in the task group");
        assert.equal(tc.tasks[0], t2, "t2 is the only task in the list");

        await t2.result();
        assert.equal(tc.tasks.length, 0, "all tasks completed and disposed");
        assert.equal(t2.completionStatus, "COMPLETED", "t2 completed");
        assert.equal(t2.completionResult, 4, "t2 returned 4");
        assert.equal(t1.completionStatus, "CANCELLED", "t1 cancelled");
        assert.equal(t1.completionResult, undefined, "t1 returned undefined");
        assert.equal(t1.cancellationReason, "test cancellation 2", "t1 cancellation reason ok");        
    });

});

