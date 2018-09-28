import * as assert from 'assert';
import { interval } from "../sources/interval";
import { TestObserver } from './testObserver';

describe("interval", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work", async function () {
        let timeStamps: number[] = [], period = 5;
        await interval(period).forEach(($$, v, output) => {
            logs.push("v:" + v);
            if (v === 5) {
                output.complete();
            }
            timeStamps.push((new Date()).getTime());
        })

        assert.deepEqual(logs, ['v:0', 'v:1', 'v:2', 'v:3', 'v:4', 'v:5'], "logs ok");

        let len = timeStamps.length, diff;
        for (let i = 1; len > i; i++) {
            diff = timeStamps[i] - timeStamps[i - 1];
            // we remove 1 from the period to avoid rounding issues
            assert.equal(diff >= period - 1, true, "elapsed time > " + period + " (diff=" + diff + ")");
        }
    });

    it("should stop when observer completes", async function () {
        let logs: string[] = [], obs = new TestObserver(logs, "obs");

        interval(10).pipe(($$, v, output) => {
            output.next(v);
        }).pipe(async ($$, nbr, output) => {
            output.next(nbr);
            output.complete();
        }).subscribe(obs);

        await obs.completion();
        assert.deepEqual(logs, ["obs: next(0)", "obs: complete()"], "logs ok");
    });
});
