import { ErrorCtxt } from './compiler';
import * as ts from "typescript";
import MagicString from "magic-string";

export interface ErrorCtxt {
    warn: (msg: string) => void;
    error: (msg: string) => void;
}

const CR = "\n",
    RX_$$PARAM_DEF = /^(\s*\$\$(Or\w+)?)\s*$/,
    RX_$$PARAM_CALL = /^(\s*\$\$)\s*$/;

export function compile(src: string, filePath: string, ctxt: ErrorCtxt): MagicString {
    let srcFile = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, /*setParentNodes */ true),
        r = new MagicString(src);

    function error(msg, pos) {
        logError(msg, pos, ctxt, src, filePath);
    }

    function scan(node: ts.Node) {
        if (!process$$Function(node)) {
            if (process$$Call(node)) {
                // error: invalid call
                error("$$ functions cannot be called outside another $$ function", node.pos);
            }
            ts.forEachChild(node, scan);
        }
    }

    function scan$$Node(node: ts.Node, fScope: number[]) {
        // scan all nodes in a $$ function
        let nk = node.kind;
        if (!process$$Function(node, fScope)) {
            process$$Call(node, fScope);
            ts.forEachChild(node, (n) => scan$$Node(n, fScope));
        }
    }

    function process$$Function(node: ts.Node, fScope?: number[]): boolean {
        // return true if node is a function declaration with a $$ as first argument
        if (node.kind === ts.SyntaxKind.FunctionDeclaration
            || node.kind === ts.SyntaxKind.FunctionExpression
            || node.kind === ts.SyntaxKind.ArrowFunction
            || node.kind === ts.SyntaxKind.Constructor) {
            let fd = node as ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
            if (fd.parameters && fd.parameters.length) {
                let p0 = fd.parameters[0];
                if (p0.name.getFullText().match(RX_$$PARAM_DEF)) {
                    if (fd.body) {
                        let fScope2: number[];
                        if (fScope) {
                            fScope2 = fScope.slice(0);
                            fScope2.push(0);
                            // increment last scope value
                            fScope[fScope.length - 1]++;
                        } else {
                            fScope2 = [0];
                        }
                        ts.forEachChild(fd.body!, (node: ts.Node) => scan$$Node(node, fScope2));
                        return true;
                    }
                }
            }
        } 
        return false;
    }

    function process$$Call(node: ts.Node, fScope?: number[]): boolean {
        // return true if node is an expression call with a $$ as first argument
        // if fScope is not provided the processing will not be done
        if (node.kind === ts.SyntaxKind.CallExpression) {
            let ce = node as ts.CallExpression;
            if (ce.arguments && ce.arguments.length) {
                let a0 = ce.arguments[0];
                if (a0.getFullText().match(RX_$$PARAM_CALL)) {
                    if (fScope) {
                        let insertPos = a0.getStart() + 2;
                        r.appendLeft(insertPos, "(" + fScope.join(",") + ")");
                        // increment last scope value
                        fScope[fScope.length - 1]++;
                    }
                    return true;
                }
            }
        }
        return false;
    }

    let diagnostics = srcFile['parseDiagnostics'];
    if (diagnostics && diagnostics.length) {
        let d: ts.Diagnostic = diagnostics[0] as any;
        error(d.messageText.toString(), d.start || 0);
    } else {
        // process all parts
        scan(srcFile);
    }

    return r;
}

function logError(msg: string, pos: number, errCtxt: ErrorCtxt, src: string, filePath: string) {
    // move pos to the first non-space character
    let s = src.slice(pos);
    if (s.match(/^([\s\n]+)/)) {
        pos += RegExp.$1.length;
    }

    // calculate line/col number and integrate file name in error msg
    let lines = src.split(CR), p = 0, line = 0, column;
    for (let ln; line < lines.length; line++) {
        ln = lines[line];
        if (p + ln.length < pos) {
            p += ln.length + 1; // + 1 for the CR at the end of the line
        } else {
            break;
        }
    }
    column = pos - p;
    errCtxt.error(`[rx-await] ${msg}\n\tfile: ${filePath}\n\tline: ${line + 1}\n\tcolumn: ${column + 1}`);
}