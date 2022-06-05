// rollup.config.js
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

export default [
  {
    input: "./src/main.js",
    output: {
      file: "./src/assets/js/bundle.js",
      format: "umd",
      name: "app",
    },

    plugins: [nodeResolve(), json()],
  },
];
