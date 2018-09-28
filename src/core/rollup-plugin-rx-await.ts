import { compile } from './compiler';

interface TransformCtxt {
    warn: (msg: string) => void;
    error: (msg: string) => void;
}

const RX_TS_FILE = /\.ts$/i;

export default function (pluginOptions?: { sourceMap: boolean, traceFile?: string, runtime?: string }) {
    let traceFile = "", sourceMap = false;

    if (pluginOptions) {
        traceFile = pluginOptions.traceFile || ""; // e.g. traceFile:"testnode.ts"
        sourceMap = pluginOptions.sourceMap !== false;
    }

    let processor = {
        options: function (rollupCfg) {
            // retrieve config if need be
        },

        transform: function (this: TransformCtxt, source, filePath: string) {
            // id corresponds to the file path
            // e.g "/Users/blaporte/Dev/hibe/src/test/main.ts" on MacOS
            // note: the options() method will always be called before transform()
            let newSource = source;

            if (filePath.match(RX_TS_FILE)) {
                let mString = compile(source, filePath, this), output = mString.toString();

                // todo manage errors
                if (traceFile && (filePath.substr(-traceFile.length) === traceFile)) {
                    console.log("")
                    console.log("############################################################################");
                    console.log("file: " + filePath);
                    console.log("############################################################################");
                    console.log(output);
                }

                if (sourceMap) {
                    return { code: output, map: mString.generateMap() };
                } else {
                    return output;
                }
            } else {
                return source;
            }
        }
    };
    return processor;
}
