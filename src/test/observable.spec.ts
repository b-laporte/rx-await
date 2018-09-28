import * as assert from 'assert';
import { Observable, output, input } from "../core/observable";
import { Observer, Message } from '../core/types';
import { TestObserver } from './testObserver';
import { cancel } from '../operators/cancel';
import { delay } from '../operators/delay';

describe("Observable", () => {
    let logs: string[] = [];

    function testRange(start = 0, count = 3): Observable<number> {
        return new Observable<number>(($$, out, subscription) => {
            let index = 0, current = start;

            do {
                if (current === 42) {
                    throw new Error("Error 42");
                } else if (current === 84) {
                    return; // complete is not called
                } else if (current === 126) {
                    cancel($$, "test range cancellation");
                    out.next(1234); // should not be received by observers
                } else if (current === 168) {
                    // test output($$) and input($$)
                    if (out && output($$) === out) {
                        out.next(168.1);
                    }
                    if (subscription && input($$) === subscription && subscription.unsubscribe) {
                        out.next(168.2);
                    }
                    out.complete();
                }
                if (index++ >= count) {
                    out.complete();
                    out.next(123); // should not be received by observers
                    break;
                }
                out.next(current++);
                if (out.closed) {
                    break;
                }
            } while (true);
        });
    }

    beforeEach(() => {
        logs = [];
    });

    // 4 ways to complete:
    // - dataGenerator calls output.complete();
    // - dataGenerator terminates
    // - uncaught error in dataGenerator
    // - task is cancelled

    it("should complete on output.complete()", async function () {
        let src = testRange(1, 3),
            obs = new TestObserver(logs, "obs");
        src.subscribe(obs);

        assert.equal(obs.closed, false, "obs not closed as subscription is triggered asynchronously");
        let r = await obs.completion();
        assert.equal(r, 1, "async obs");

        assert.deepEqual(logs, [
            "obs: next(1)",
            "obs: next(2)",
            "obs: next(3)",
            "obs: complete()"
        ], "logs ok");
    });

    it("should complete on dataGenerator termination", async function () {
        let src = testRange(83, 10),
            obs = new TestObserver(logs, "obs");
        src.subscribe(obs);

        await obs.completion();

        assert.deepEqual(logs, [
            "obs: next(83)",
            "obs: complete()"
        ], "logs ok");
    });

    it("should complete when dataGenerator throws an error", async function () {
        let src = testRange(41, 10),
            obs = new TestObserver(logs, "obs");
        src.subscribe(obs);

        await obs.completion();

        assert.deepEqual(logs, [
            "obs: next(41)",
            "obs: error([Error / Error 42])",
            "obs: complete()"
        ], "logs ok");
    });

    it("should complete if dataGenerator task is cancelled", async function () {
        let src = testRange(124, 10),
            obs = new TestObserver(logs, "obs");
        src.subscribe(obs);

        await obs.completion();

        assert.deepEqual(logs, [
            "obs: next(124)",
            "obs: next(125)", // no error sent to observer in this case
            "obs: complete()"
        ], "logs ok");
    });

    it("should terminate when observer unsubscribes", async function () {
        return new Promise((resolve) => {
            let src = testRange(1, 10),
                count = 0,
                subscription = src.subscribe((v) => {
                    logs.push("next: " + v);
                    count++;
                    if (count === 3) {
                        subscription.unsubscribe();

                        setTimeout(() => {
                            // timeout to check that nothing is added to the logs
                            assert.deepEqual(logs, ["next: 1", "next: 2", "next: 3"], "logs ok");
                            resolve();
                        }, 1)
                    }
                }, (e) => {
                    logs.push("error: " + e);
                }, () => {
                    logs.push("complete");
                });
        });
    });

    it("should support output($$) and input($$) in Observable function", async function () {
        await testRange(168, 1).forEach(($$, v) => {
            logs.push("v:" + v);
        });

        assert.deepEqual(logs, ["v:168.1", "v:168.2"], "ok");
    });

    describe("pipe", () => {

        it("should work with a sync function", async function () {
            let count = 0, obs = new TestObserver(logs, "obs");

            let o = testRange(0, 5).pipe(($$, value: number, output: Observer<string>) => {
                logs.push("count: " + count);
                count++;
                // output strings from odd numbers
                if (value % 2) {
                    output.next("value: " + value);
                }
            });
            assert.equal(logs.length, 0, "logs is empty");

            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");

            await obs.completion();
            assert.deepEqual(logs, [
                "count: 0",
                "count: 1",
                "obs: next(value: 1)",
                "count: 2",
                "count: 3",
                "obs: next(value: 3)",
                "count: 4",
                "obs: complete()"
            ], "logs ok");
        });

        it("should work with an async function", async function () {
            let count = 0, obs = new TestObserver(logs, "obs");

            let o = testRange(0, 5).pipe(async ($$, value: number, output: Observer<string>) => {
                logs.push("count: " + count);
                count++;
                await delay($$, 1);
                // output strings from odd numbers
                if (value % 2) {
                    output.next("value: " + value);
                }
            });
            assert.equal(logs.length, 0, "logs is empty");

            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");

            await obs.completion();
            assert.deepEqual(logs, [
                "count: 0",
                "count: 1",
                "count: 2",
                "count: 3",
                "count: 4",
                "obs: next(value: 1)",
                "obs: next(value: 3)",
                "obs: complete()"
            ], "logs ok");
        });

        it("should unsubscribe when complete is called in pipe", async function () {
            let obs = new TestObserver(logs, "obs");

            let o = testRange(0, 9).pipe(async ($$, value: number, output: Observer<string>) => {
                // output strings from odd numbers
                if (value === 7) {
                    output.complete();
                }
                if (value % 2) {
                    output.next("value: " + value);
                }
            });

            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");
            await obs.completion();
            assert.deepEqual(logs, [
                "obs: next(value: 1)",
                "obs: next(value: 3)",
                "obs: next(value: 5)",
                "obs: complete()"
            ], "logs ok");
        });

        it("should support a pipe chain (complete in 1st pipe)", async function () {
            let obs = new TestObserver(logs, "obs");

            let o = testRange(0, 9)
                .pipe(($$, value: number, output: Observer<string>) => {
                    if (value !== 2) {
                        output.next("v:" + value);
                    }
                    if (value === 5) {
                        output.complete();
                    }
                })
                .pipe(async ($$, value: string, output: Observer<string>) => {
                    // output strings from odd numbers
                    if (value === "v:42") {
                        output.complete();
                    }
                    output.next(":" + value);
                });

            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");
            await obs.completion();
            assert.deepEqual(logs, [
                "obs: next(:v:0)",
                "obs: next(:v:1)",
                "obs: next(:v:3)",
                "obs: next(:v:4)",
                "obs: next(:v:5)",
                "obs: complete()"
            ], "logs ok (1)");

            logs = [];
            let obs2 = new TestObserver(logs, "obs2");
            o.subscribe(obs2);
            assert.equal(logs.length, 0, "logs is still empty (async)");
            await obs2.completion();
            assert.deepEqual(logs, [
                "obs2: next(:v:0)",
                "obs2: next(:v:1)",
                "obs2: next(:v:3)",
                "obs2: next(:v:4)",
                "obs2: next(:v:5)",
                "obs2: complete()"
            ], "logs ok (2)");

        });

        it("should support a pipe chain (complete in 2nd pipe)", async function () {
            let obs = new TestObserver(logs, "obs");

            let o = testRange(1, 9)
                .pipe(($$, value: number, output: Observer<string>) => {
                    if (value % 2) {
                        output.next("v:" + value);
                    }
                })
                .pipe(async ($$, value: string, output: Observer<string>) => {
                    // output strings from odd numbers
                    if (value === "v:5") {
                        output.complete();
                    }
                    output.next(":" + value);
                });

            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");
            await obs.completion();
            assert.deepEqual(logs, [
                "obs: next(:v:1)",
                "obs: next(:v:3)",
                "obs: complete()"
            ], "logs ok (1)");
        });
    });

    describe("foreach", () => {
        it("should return a promise", async function () {
            let p = testRange(1, 3).forEach(($$, value, output) => {
                logs.push("forEach: " + value);
            });

            assert.equal(logs.length, 0, "empty logs - asynchronous subscription");
            await p;
            assert.deepEqual(logs, [
                "forEach: 1",
                "forEach: 2",
                "forEach: 3"
            ], "logs ok");
        });

        it("should be cancellable", async function () {
            let p = testRange(1, 3).forEach(($$, value, output) => {
                logs.push("forEach: " + value);
            });

            let err: any = null, p2 = p.catch((e) => {
                err = e;
            });

            await p.cancel();
            assert.equal(logs.length, 0, "no logs");
        });

        it("should allow to complete earlier", async function () {
            let p = testRange(1, 10).forEach(($$, value, output) => {
                logs.push("forEach: " + value);
                if (value === 3) {
                    logs.push("forEach: complete");
                    output.complete();
                }
            });

            await p;
            assert.deepEqual(logs, [
                "forEach: 1",
                "forEach: 2",
                "forEach: 3",
                "forEach: complete"
            ], "logs ok");
        });

        it("should support output($$) and input($$)", async function () {
            await testRange(0, 10).forEach(($$, v, out, subscription) => {
                if (out && out === output($$)) {
                    logs.push("output:ok");
                }
                if (subscription && subscription === input($$)) {
                    logs.push("input:ok");
                }
                subscription.unsubscribe();
            });

            assert.deepEqual(logs, ["output:ok", "input:ok"], "ok");
        });

        // it("should stop if an error occurs in the foreach function", function () {
        //     // todo? is it valid?
        // });
    });

    describe("process", () => {

        it("should work with a sync function", async function () {
            let count = 0, obs = new TestObserver(logs, "obs");

            let o = testRange(0, 5).process(($$, m: Message<number>, output: Observer<string>) => {
                logs.push("count: " + count);
                if (m.isData()) {
                    let value = m.data!;

                    count++;
                    // output strings from odd numbers
                    if (value % 2) {
                        output.next("value: " + value);
                    }
                }
            });
            assert.equal(logs.length, 0, "logs is empty");

            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");

            await obs.completion();
            assert.deepEqual(logs, [
                "count: 0",
                "count: 1",
                "obs: next(value: 1)",
                "count: 2",
                "count: 3",
                "obs: next(value: 3)",
                "count: 4",
                "count: 5",
                "obs: complete()"
            ], "logs ok");
        });

        it("should output and process errors", async function () {
            let o = testRange(0, 5).process(($$, m: Message<number>, output: Observer<number>) => {
                if (m.isData()) {
                    let value = m.data!;
                    logs.push("v1: " + value);
                    if (value === 3) {
                        output.error(new Error("Error 3"));
                    } else {
                        output.next(value * 2);
                    }
                }
            }).process(($$, m: Message<number>, output: Observer<string>) => {
                if (m.isData()) {
                    let value = m.data!;
                    output.next("v2: " + value);
                } else if (m.isError()) {
                    output.next("err2: " + m.error!.message);
                }
            });

            let obs = new TestObserver(logs, "obs");
            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");
            await obs.completion();
            assert.deepEqual(logs, [
                "v1: 0",
                "obs: next(v2: 0)",
                "v1: 1",
                "obs: next(v2: 2)",
                "v1: 2",
                "obs: next(v2: 4)",
                "v1: 3",
                "obs: next(err2: Error 3)",
                "v1: 4",
                "obs: next(v2: 8)",
                "obs: complete()"
            ], "logs ok");
        });

        it("should process completion", async function () {
            let o = testRange(0, 5).process(($$, m: Message<number>, output: Observer<number>) => {
                if (m.isCompletion()) {
                    output.next(42);
                    output.complete();
                }
            }).process(($$, m: Message<number>, output: Observer<string>) => {
                if (m.isData()) {
                    output.next("v: " + m.data!);
                }
            });

            let obs = new TestObserver(logs, "obs");
            o.subscribe(obs);
            assert.equal(logs.length, 0, "logs is still empty (async)");
            await obs.completion();
            assert.deepEqual(logs, [
                "obs: next(v: 42)",
                "obs: complete()"
            ], "logs ok");
        });
    });

    describe("processEach", () => {
        it("should process value and completion messages", async function () {
            let count = 0;

            await testRange(0, 5).processEach(($$, m: Message<number>, output: Observer<string>) => {
                logs.push("count: " + count);
                if (m.isData()) {
                    let value = m.data!;
                    count++;
                    if (value % 2) {
                        logs.push("value: " + value);
                    }
                } else if (m.isCompletion()) {
                    logs.push("complete")
                }
            });
            
            assert.deepEqual(logs, [
                "count: 0",
                "count: 1",
                "value: 1",
                "count: 2",
                "count: 3",
                "value: 3",
                "count: 4",
                "count: 5",
                "complete"
            ], "logs ok");
        });
    });
});