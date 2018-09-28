import * as assert from 'assert';
import { of } from '../sources/of';
import { defaultIfEmpty } from '../operators/defaultIfEmpty';

describe("defaultIfEmpty", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work with non-empty streams", async function () {
        await of(3, 1, 4).processEach(($$, m) => {
            let v = defaultIfEmpty($$, m, 42);
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:3', 'v:1', 'v:4'], "logs ok");
    });

    it("should work with empty streams", async function () {
        await of().processEach(($$, m) => {
            let v = defaultIfEmpty($$, m, 42);
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:42'], "logs ok");
    });

    it("should cancel task when errors are found", async function () {
        await of(3, 1, 4, 1).pipe(($$, v, output) => {
            if (v === 4) {
                output.error("Error 4");
            } else {
                output.next(v);
            }
        }).processEach(($$, m) => {
            let v = defaultIfEmpty($$, m, 42);
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:3', 'v:1', 'v:1'], "logs ok");
    });

    it("should complete when a completion message is sent", async function () {
        await of(3, 1, 4, 1).pipe(($$, v, output) => {
            if (v === 4) {
                output.complete();
            } else {
                output.next(v);
            }
        }).processEach(($$, m) => {
            let v = defaultIfEmpty($$, m, 42);
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ['v:3', 'v:1'], "logs ok");
    });

});
