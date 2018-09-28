import * as assert from 'assert';
import { range } from '../sources/range';
import { cancelAll } from '../operators/cancelAll';

describe("range", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work", async function () {
        await range(1, 5).forEach(($$, v, output) => {
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:1', 'v:2', 'v:3', 'v:4', 'v:5'], "logs ok");
    });

    it("should be stopped by complete", async function () {
        await range(1, 5).forEach(($$, v, output) => {
            logs.push("v:" + v);
            if (v === 3) {
                output.complete();
            }
        });

        assert.deepEqual(logs, ['v:1', 'v:2', 'v:3'], "logs ok");
    });

    it("should be stopped when used in a $$ function that is cancelled", async function () {

        await range(0, 3).forEach(async ($$, v, mainOutput) => {
            logs.push("a:" + v);

            if (v == 2) {
                cancelAll($$, "test", false); // do not cancel current task
            }

            await range($$, 10 * v, 2).forEach(($$, i, output) => {
                logs.push("b:" + i); // will be cancelled (as asynchronous) except for v === 2
            });
        })

        assert.deepEqual(logs, [
            "a:0",
            "a:1",
            "a:2",
            "b:20",
            "b:21"
        ], "logs ok")
    });
});
