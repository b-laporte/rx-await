import * as assert from 'assert';
import { of } from '../sources/of';
import { zip } from '../sources/zip';
import { task } from '../core/tasks';
import { cancel } from '../operators/cancel';
import { delay } from '../operators/delay';
import { debounceTime } from '../operators/debounceTime';
import { callStackContext } from '../operators/callStackContext';

describe("zip", () => {
    let logs: string[] = [];

    beforeEach(() => {
        logs = [];
    });

    it("should work with streams of the same length", async function () {
        let o1 = of(1, 3, 5, 7),
            o2 = of(2, 4, 6, 8);

        await zip([o1, o2]).forEach(($$, values: number[]) => {
            logs.push(values.join("::"));
        })

        assert.deepEqual(logs, ['1::2', '3::4', '5::6', '7::8'], "logs ok");
    });

    it("should work with streams of different length", async function () {
        let o1 = of(1, 3, 5, 7),
            o2 = of(2, 4, 6);

        await zip([o1, o2]).forEach(($$, values: number[]) => {
            logs.push(values.join("::"));
        })

        assert.deepEqual(logs, ['1::2', '3::4', '5::6'], "logs ok");
    });

    it("should work inside another task", async function () {
        await of(0, 1, 2, 3, 4, 5).forEach(async ($$, v) => {
            let mainTask = task($$),
                a = of($$, v + 1, v + 3, v + 5),
                b = of($$, v + 2, v + 4, v + 6);

            await zip($$, [a, b]).forEach(($$, values: number[]) => {
                if (values[1] > 5) {
                    cancel($$, mainTask);
                }
                logs.push(values.join("::"));
            });
        });

        assert.deepEqual(logs, ['1::2', '3::4', '2::3', '4::5', '3::4', '4::5'], "logs ok");
    });

});


