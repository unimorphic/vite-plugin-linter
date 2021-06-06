import { Plugin } from "vite";
import { LinterPluginOptions } from "./linterPlugin";
import { normalizePath } from "./utils";

export default function linterPluginBuild(
  options: LinterPluginOptions = {} as LinterPluginOptions,
  filter: (id: string | unknown) => boolean
): Plugin {
  const files: string[] = [];

  return {
    apply: "build",
    enforce: "pre",
    name: "vite-plugin-linter-build",

    async buildEnd() {
      let hasOutput = false;
      for (const linter of options.linters) {
        const result = await linter.lintBuild(files);
        const output = await linter.format(result);
        if (output) {
          this.warn(output);
          hasOutput = true;
        }
      }
      if (hasOutput) {
        this.error("Linting failed, see above output");
      }
    },

    transform(code, id) {
      if (filter(id)) {
        files.push(normalizePath(id));
      }

      return null;
    },
  };
}
