import { Observer } from '../core/types';

export class TestObserver<T> implements Observer<T> {
    closed = false;
    private _logs: string[];
    private _onComplete: (() => void) | null = null;

    constructor(logs, public name = "simple_observer") {
        this._logs = logs;
    }

    next(value: T): void {
        this._logs.push(this.name + ": next(" + value + ")")
    }

    error(err: any): void {
        if (err.constructor === Error) {
            let e = err as Error;
            this._logs.push(this.name + ": error([" + e.name + " / " + e.message + "])")
        } else {
            this._logs.push(this.name + ": error(" + err + ")");
        }
    }

    complete() {
        if (!this.closed) {
            this.closed = true;
            this._logs.push(this.name + ": complete()")
            if (this._onComplete) {
                this._onComplete();
            }
        }
    }

    async completion(): Promise<any> {
        if (!this.closed) {
            return new Promise((resolve) => {
                this._onComplete = () => resolve(1);
            })
        }
        return 0;
    }
}
