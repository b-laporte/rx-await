import { STACK_ID } from '../core/tasks';

export let trace = {
    logs: [] as string[],
    reset() {
        this.logs = []
    },
    logPrefix(funcName: string, t) {
        this.logs.push(funcName + " prefix: '" + t[STACK_ID] + "'");
    },
    logValue(v, from = "") {
        this.logs.push("value: " + v + from);
    }
}

export function simpleTask($$, v: number) {
    trace.logPrefix("simpleTask", $$);
    trace.logValue(v * 2);
    return v * 2;
}

export function simpleTaskWithSubTask($$, v: number) {
    trace.logPrefix("simpleTaskWithSubTask", $$);
    v = subTask($$, v, 2);

    v += 1000;
    trace.logValue(v);
    return v;
}

export function subTask($$, v: number, count = 1) {
    trace.logPrefix("subTask", $$);
    v += 10;
    if (count) {
        v = simpleTask($$, v);
        v = subTask($$, v, count - 1);
    }
    v += 10;
    trace.logValue(v);
    return v;
}

export async function simpleTaskWithLoop($$, v: number) {
    trace.logPrefix("simpleTaskWithLoop", $$);
    let len = v;
    for (let i = 0; len > i; i++) {
        v += 10;
        v = simpleTask($$, v);
        v += 10;
    }
    v += 1000;
    trace.logValue(v);
    return v;
}