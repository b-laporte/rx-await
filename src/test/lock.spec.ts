import * as assert from 'assert';
import { of } from '../sources/of';
import { Task } from '../core/types';
import { task } from '../core/tasks';
import { lock } from '../operators/lock';
import { cancel } from '../operators/cancel';
import { delay } from '../operators/delay';

describe("lock", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work", async function () {
        let lockedTask: Task | null = null

        await of(3, 1, 4, 42, 5, 8, 42, 9).forEach(async ($$, v, output) => {
            if (!lockedTask) {
                lockedTask = task($$);
            } else if (v === 42) {
                cancel($$, lockedTask);
                lockedTask = null;
                return;
            }

            lock($$);

            logs.push("v:" + v);
            await delay($$, 10);
            logs.push("v2:" + v);
        });

        assert.deepEqual(logs, ['v:3', 'v:5', 'v:9', 'v2:9'], "logs ok");
    });

});
