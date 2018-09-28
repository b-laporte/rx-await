import * as assert from 'assert';
import { of } from '../sources/of';

describe("of", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work", async function () {

        await of(3, 1, 4, 1, 5).forEach(($$, v, output) => {
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:3', 'v:1', 'v:4', 'v:1', 'v:5'], "logs ok");
    });

});
