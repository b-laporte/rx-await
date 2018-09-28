import * as assert from 'assert';
import { of } from '../sources/of';
import { distinctUntilChanged } from '../operators/distinctUntilChanged';

describe("distinctUntilChanged", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work", async function () {

        await of(3, 1, 1, 1, 4, 4, 2, 5, 5).forEach(($$, v, output) => {
            distinctUntilChanged($$, v);
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:3', 'v:1', 'v:4', 'v:2', 'v:5'], "logs ok");
    });

});
