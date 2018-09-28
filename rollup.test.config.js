import rxAwait from './dist/rollup-plugin-rx-await.es'
import typescript from 'rollup-plugin-typescript2';
// import gzip from "rollup-plugin-gzip";
// import minify from 'rollup-plugin-minify-es';

export default {
  input: "src/test/main.spec.ts",
  output: {
    file: "dist/test.js",
    sourcemap: true,
    format: "cjs"
  },
  plugins: [typescript(), rxAwait({ sourceMap: true })], // , minify() , gzip()
  external: ['mocha', 'typescript', 'assert', 'magic-string']
};
