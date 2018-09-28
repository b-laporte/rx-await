import { TestObserver } from './testObserver';
import * as assert from 'assert';
import { of } from '../sources/of';
import { interval } from '../sources/interval';
import { debounceTime } from '../operators/debounceTime';
import { Observer } from '../core/types';

describe("doc samples", () => {
    it("should demo simple transformation", async function () {
        let logs: string[] = [], obs = new TestObserver(logs, "obs");

        of(1, 2, 3, 4, 5).pipe(($$, value, output) => {
            if (value % 2) {
                output.next(value * 10);
                output.next(value * 10 + 1);
            }
            if (value > 3) {
                output.complete();
            }
        }).subscribe(obs);

        await obs.completion();
        assert.deepEqual(logs, ["obs: next(10)", "obs: next(11)", "obs: next(30)", "obs: next(31)", "obs: complete()"], "logs ok");
    });

    it("should demo transformation with debounceTime", async function () {
        let logs: string[] = [], obs = new TestObserver(logs, "obs");

        interval(10).pipe(($$, v, output: Observer<number>) => {
            if (v !== 3 && v !== 4) {
                output.next(v);
            }
        }).pipe(async ($$, nbr, output) => {
            await debounceTime($$, 25);
            output.next(nbr);
            output.complete();
        }).subscribe(obs);

        await obs.completion();
        assert.deepEqual(logs, ["obs: next(2)", "obs: complete()"], "logs ok");
    });

});
