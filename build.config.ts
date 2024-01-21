import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index", "src/lintCommand", "src/lintWorkerThread"],
  externals: ["vite", "@rollup/pluginutils"],
  declaration: true,
  rollup: {
    emitCJS: true,
  },
});
