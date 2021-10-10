import { Plugin } from "vite";
import { IncludeMode, LinterPluginOptions } from "./linterPlugin";
import { normalizePath, readAllFiles } from "./utils";

export const buildPluginName = "vite-plugin-linter-build";

export default function linterPluginBuild(
  options: LinterPluginOptions = {} as LinterPluginOptions,
  fileFilter: (id: string | unknown) => boolean
): Plugin {
  const includeMode: IncludeMode =
    options.build?.includeMode ?? "processedFiles";
  const transformedFiles: string[] = [];

  async function lintFiles(files: string[]): Promise<string[]> {
    const outputLines: string[] = [];
    for (const linter of options.linters) {
      const result = await linter.lintBuild(files);
      const output = await linter.format(result);
      if (output) {
        outputLines.push(output);
      }
    }

    return outputLines;
  }

  async function lintFolder(folder: string): Promise<string[]> {
    const files: string[] = readAllFiles(folder, fileFilter).map((f) =>
      normalizePath(f)
    );

    return lintFiles(files);
  }

  return {
    apply: "build",
    enforce: "pre",
    name: buildPluginName,

    async buildEnd() {
      let outputLines: string[];
      if (includeMode === "filesInFolder") {
        outputLines = await lintFolder(process.cwd());
      } else {
        outputLines = await lintFiles(transformedFiles);
      }

      if (outputLines.length > 0) {
        for (const output of outputLines) {
          this.warn(output);
        }
        this.error("Linting failed, see above output");
      }
    },

    transform(code, id) {
      if (!fileFilter(id) || includeMode === "filesInFolder") {
        return null;
      }

      transformedFiles.push(normalizePath(id));

      return null;
    },
  };
}
