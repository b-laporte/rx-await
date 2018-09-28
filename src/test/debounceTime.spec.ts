import * as assert from 'assert';
import { interval } from "../sources/interval";
import { debounceTime } from '../operators/debounceTime';
import { cancel } from '../operators/cancel';

describe("debounceTime", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work", async function () {

        await interval(5).forEach(async ($$, v, output, input) => {
            if (v > 3) {
                // unsubscribe after v === 4
                input.unsubscribe();
            }
            logs.push("a:" + v);
            await debounceTime($$, 10);
            logs.push("done:" + v); // only last value (i.e. 4) will manage to get here
            output.complete();
        })

        assert.deepEqual(logs, ['a:0', 'a:1', 'a:2', 'a:3', 'a:4', 'done:4'], "logs ok");

    });
});
