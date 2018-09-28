import * as assert from 'assert';
import { ErrorCtxt, compile } from '../core/compiler';

class ErrorContext implements ErrorCtxt {
    private messages: string[] = [];

    reset() {
        if (this.messages.length) {
            this.messages = [];
        }
    }
    warn(msg: string): void {
        this.messages.push("WARN: " + msg);
    }
    error(msg: string): void {
        this.messages.push("ERROR: " + msg);
    }
    toString(): string {
        return this.messages.length ? this.messages.join(", ") : "";
    }
    compare(arr: { type: string, msg: string, line: number, column: number, file: string }[]): string {
        if (this.messages.length !== arr.length) {
            return "Different error count";
        }
        let itm, msg = "";
        for (let i = 0; arr.length > i; i++) {
            itm = arr[i];
            msg = `${itm.type}: ${itm.msg}\n\tfile: ${itm.file}\n\tline: ${itm.line}\n\tcolumn: ${itm.column}`;
            if (msg !== this.messages[i]) {
                return `Different messages[${i}]:\n\tactual:\n\t${this.messages[i]}\n\n\texpected:\n\t${msg}`;
            }
        }
        return "";
    }
}

describe("Compiler", () => {
    let err = new ErrorContext();

    beforeEach(function () {
        err.reset();
    })

    afterEach(function () {
        assert.equal(err.toString(), "", "No errors");
    })

    it("should compile $$ calls in function()", function () {
        assert.equal(compile(`
            // file0
            let x=42;
            function foo ( $$  , a, b) {
                let z=123;
                b += subFunction(   $$  , a+2);
                foo($$);
                bar($$, bar($$));
                return b;
            }
        `, "file0", err).toString(), `
            // file0
            let x=42;
            function foo ( $$  , a, b) {
                let z=123;
                b += subFunction(   $$(0)  , a+2);
                foo($$(1));
                bar($$(2), bar($$(3)));
                return b;
            }
        `, "$$ update");

    });

    it("should compile $$ calls in $$OrXxx function()", function () {
        assert.equal(compile(`
            // file0
            let x=42;
            function foo ( $$OrAbc  , a, b) {
                let z=123;
                b += subFunction(   $$  , a+2);
                foo($$);
                bar($$, bar($$));
                return b;
            }
        `, "file0", err).toString(), `
            // file0
            let x=42;
            function foo ( $$OrAbc  , a, b) {
                let z=123;
                b += subFunction(   $$(0)  , a+2);
                foo($$(1));
                bar($$(2), bar($$(3)));
                return b;
            }
        `, "$$ update");

    });

    it("should compile $$ functions in $$ functions", function () {
        assert.equal(compile(`
            function foo ($$) {
                let z=123;
                bar($$);
                let x, z = function($$) {
                    baz($$);
                    blah($$,123);
                }
                return z($$);
            }
        `, "file0", err).toString(), `
            function foo ($$) {
                let z=123;
                bar($$(0));
                let x, z = function($$) {
                    baz($$(1,0));
                    blah($$(1,1),123);
                }
                return z($$(2));
            }
        `, "$$ update");

    });

    it("should compile $$ functions in $$ constructors", function () {
        assert.equal(compile(`
            class Foo {
                constructor ($$) {
                    bar($$);
                    baz($$, 123);
                }
            }
        `, "file0", err).toString(), `
            class Foo {
                constructor ($$) {
                    bar($$(0));
                    baz($$(1), 123);
                }
            }
        `, "$$ update");

    });

    it("should compile $$ arrow functions", function () {
        assert.equal(compile(`
            let foo = ( $$) => {
                let z=123;
                bar($$);
                let x, z = (   $$) => {
                    baz($$);
                }
                return z($$);
            }
        `, "file0", err).toString(), `
            let foo = ( $$) => {
                let z=123;
                bar($$(0));
                let x, z = (   $$) => {
                    baz($$(1,0));
                }
                return z($$(2));
            }
        `, "$$ update");

    });

    it("should compile if and for blocks", function () {
        assert.equal(compile(`
            function f ($$) {
                blah($$);
                if (123) {
                    foo($$, $);
                }
                x($);
                for (let i=0;10>i;i++) {
                    bar($$, $);
                }
            }
        `, "file0", err).toString(), `
            function f ($$) {
                blah($$(0));
                if (123) {
                    foo($$(1), $);
                }
                x($);
                for (let i=0;10>i;i++) {
                    bar($$(2), $);
                }
            }
        `, "$$ update");
    });

    it("should raise an error if $$ functions are called outside $$ functions", function () {
        let r = compile(`
            function f() {
                blah($);
                if (123) {
                    foo($$, $);
                }
            }
        `, "file0", err);

        assert.equal(r.toString(), `
            function f() {
                blah($);
                if (123) {
                    foo($$, $);
                }
            }
        `, "$$ update");

        assert.equal(err.compare([{ type: "ERROR", msg: "[rx-await] $$ functions cannot be called outside another $$ function", line: 5, column: 21, file: "file0" }]), "", "correct error message");
        err.reset();
    });

});
