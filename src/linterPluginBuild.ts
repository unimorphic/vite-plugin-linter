import { IncludeMode, LinterPluginBase, LinterPluginOptions } from "./linterPlugin";
import { createWorkerThreads, WorkerThreadMessage } from "./lintWorkerThread";
import { normalizePath, readAllFiles } from "./utils";

export const buildPluginName = "vite-plugin-linter-build";

export interface LinterBuildPlugin extends LinterPluginBase {
  lintFolder(folder: string): Promise<string[]>;
}

export default function linterPluginBuild(
  options: LinterPluginOptions = {} as LinterPluginOptions,
  fileFilter: (id: string | unknown) => boolean
): LinterBuildPlugin {
  const includeMode: IncludeMode =
    options.build?.includeMode ?? "processedFiles";
  const transformedFiles: string[] = [];

  function getLintFiles(folder: string): string[] {
    return readAllFiles(folder, fileFilter).map((f) => normalizePath(f));
  }

  return {
    apply: "build",
    enforce: "pre",
    name: buildPluginName,

    async buildEnd() {
      let files: string[];
      if (includeMode === "filesInFolder") {
        files = getLintFiles(process.cwd());
      } else {
        files = transformedFiles;
      }

      const workersByLinterName = createWorkerThreads(
        "build",
        buildPluginName,
        options.linters
      );

      const lintTasks: Promise<string>[] = [];
      for (const linterName of Object.keys(workersByLinterName)) {
        lintTasks.push(
          new Promise<string>((resolve) => {
            const worker = workersByLinterName[linterName];

            worker.on("message", async (message: WorkerThreadMessage) => {
              const linter = options.linters.find(
                (l) => l.name === message.linterName
              )!;
              resolve(await linter.format(message.result.build!));
              worker.terminate();
            });

            worker.postMessage(files);
          })
        );
      }

      const results = (await Promise.all(lintTasks)).filter((r) => r);
      for (const result of results) {
        this.warn(result);
      }
      if (results.length > 0) {
        this.error("Linting failed, see above output");
      }
    },

    getLinter(name: string) {
      return options.linters.find((l) => l.name === name);
    },

    async lintFolder(folder: string) {
      const files = getLintFiles(folder);

      const outputLines: string[] = [];
      for (const linter of options.linters) {
        const result = await linter.lintBuild(files);
        const output = await linter.format(result);
        if (output) {
          outputLines.push(output);
        }
      }

      return outputLines;
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
