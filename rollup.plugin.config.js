
import typescript from 'rollup-plugin-typescript2';
// import gzip from "rollup-plugin-gzip";
// import minify from 'rollup-plugin-minify-es';
const pkg = require('./package.json');

export default {
  input: "src/core/rollup-plugin-rx-await.ts",
  output: {
    file: pkg["rollup-plugin-main"],
    sourcemap: true,
    format: "es"
  },
  plugins: [typescript()], // , minify() , gzip()
  external: ['typescript', 'magic-string']
};
