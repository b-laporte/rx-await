import * as assert from 'assert';
import { callStackContext } from '../operators/callStackContext';
import { createTaskGroup } from '../core/tasks';

describe("callStackContext", () => {
    
    it("should work with sub-functions", function () {
        let logs: string[] = [];

        function sub($$, v: number) {
            let c = callStackContext($$, () => ({ lastValue: "" }));
            c.lastValue += ":" + v;
            logs.push(`sub ${c.lastValue}`);

            if (v >= 42) {
                sub($$, v - 40);
            }
        }

        function main($$, v) {
            sub($$, v);
            sub($$, v + 1);
        }

        let tc = createTaskGroup(main);
        tc.processNewTask(1);
        assert.deepEqual(logs, [
            "sub :1",
            "sub :2"
        ], "logs ok - 1st call");

        logs = [];
        tc.processNewTask(42);
        assert.deepEqual(logs, [
            "sub :1:42",
            "sub :2",
            "sub :2:43",
            "sub :3"
        ], "logs ok - 2nd call");

        logs = [];
        tc.processNewTask(8);
        assert.deepEqual(logs, [
            "sub :1:42:8",
            "sub :2:43:9"
        ], "logs ok - 3rd call");

        logs = [];
        tc.processNewTask(44);
        assert.deepEqual(logs, [
            "sub :1:42:8:44",
            "sub :2:4",
            "sub :2:43:9:45",
            "sub :3:5"
        ], "logs ok - 4th call");

    });
});