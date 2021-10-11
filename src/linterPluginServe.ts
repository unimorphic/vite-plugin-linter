import fs from "fs";
import path from "path";
import { PluginContext } from "rollup";
import { ViteDevServer } from "vite";
import { Worker } from "worker_threads";
import Linter from "./Linter";
import {
  IncludeMode,
  LinterPluginBase,
  LinterPluginOptions,
  LinterResultData,
} from "./linterPlugin";
import { createWorkerThreads, WorkerThreadMessage } from "./lintWorkerThread";
import { normalizePath, readAllFiles } from "./utils";

export const servePluginName = "vite-plugin-linter-serve";

const clientEventName = "eslint-warn";

const clientJs = `
  if (import.meta.hot) {
    fetch("/eslint.json")
      .then(r => r.json())
      .then(response => {
        if (response) {
          for (let line of response) {
            console.warn(line);
          }
        }
      })
      .catch(e => console.error(e));

    import.meta.hot.on("${clientEventName}", d => console.warn(d));
  }
`;

export default function linterPluginServe(
  options: LinterPluginOptions = {} as LinterPluginOptions,
  fileFilter: (id: string | unknown) => boolean
): LinterPluginBase {
  let devServer: ViteDevServer | null = null;
  const includeMode: IncludeMode =
    options.serve?.includeMode ?? "processedFiles";
  let injectedFile: string | null = null;
  let lintFiles: string[] = [];
  let processingTimeout: NodeJS.Timeout;
  let workersByLinterName: { [linterName: string]: Worker } = {};

  let dataByFileNameByLinterName: {
    [linterName: string]: { [fileName: string]: LinterResultData };
  } = {};
  for (const linter of options.linters) {
    dataByFileNameByLinterName[linter.name] = {};
  }

  async function getFormattedOutput(
    linter: Linter<LinterResultData>
  ): Promise<string> {
    const dataByFileName = dataByFileNameByLinterName[linter.name];

    const allData: LinterResultData[] = [];
    for (const file of Object.keys(dataByFileName)) {
      allData.push(dataByFileName[file]);
    }
    if (allData.length > 0) {
      return await linter.format(allData);
    }

    return "";
  }

  async function onWorkerMessage(
    message: WorkerThreadMessage,
    pluginContext: PluginContext
  ): Promise<void> {
    const dataByFileName = dataByFileNameByLinterName[message.linterName];

    for (const file of message.files) {
      if (file in message.result.serve!) {
        dataByFileName[file] = message.result.serve![file];
      } else if (file in dataByFileName) {
        delete dataByFileName[file];
      }
    }

    const linter = options.linters.find((l) => l.name === message.linterName)!;
    const output = await getFormattedOutput(linter);
    if (output) {
      pluginContext.warn(output);

      if (devServer) {
        devServer.ws.send({
          event: clientEventName,
          data: output,
          type: "custom",
        });
      }
    }
  }

  async function processFiles(): Promise<void> {
    const files = [...lintFiles];
    if (includeMode !== "filesInFolder") {
      lintFiles = [];
    }

    for (const linter of options.linters) {
      workersByLinterName[linter.name].postMessage(files);
    }
  }

  function watchDirectory(
    directory: string,
    pluginContext: PluginContext
  ): void {
    function onChange(itemName: string): void {
      if (!itemName) {
        return;
      }

      const fullPath = path.join(directory, itemName);
      const normalizedPath = normalizePath(fullPath);
      let changed = false;

      if (fileFilter(fullPath)) {
        if (
          includeMode === "filesInFolder" &&
          !lintFiles.includes(normalizedPath)
        ) {
          lintFiles.push(normalizedPath);
        }
        changed = true;
      } else if (
        fs.existsSync(itemName) &&
        fs.lstatSync(itemName).isDirectory()
      ) {
        const children = readAllFiles(fullPath, fileFilter).map((f) =>
          normalizePath(f)
        );

        if (includeMode === "filesInFolder") {
          for (const child of children) {
            if (!lintFiles.includes(child)) {
              lintFiles.push(child);
              changed = true;
            }
          }
          for (let index = lintFiles.length - 1; index >= 0; index--) {
            const file = lintFiles[index];
            if (file.startsWith(normalizedPath) && !children.includes(file)) {
              lintFiles.splice(index, 1);
              changed = true;
            }
          }
        }

        for (const linter of options.linters) {
          const dataByFileName = dataByFileNameByLinterName[linter.name];
          for (const file of Object.keys(dataByFileName)) {
            if (file.startsWith(normalizedPath) && !children.includes(file)) {
              delete dataByFileName[file];
            }
          }
        }
      }

      if (includeMode === "filesInFolder" && changed) {
        processFiles();
      }
    }

    let watchTimeout: NodeJS.Timeout;
    fs.watch(
      directory,
      { persistent: false, recursive: true },
      (event, fileName) => {
        clearTimeout(watchTimeout); // Ignore duplicate events
        watchTimeout = setTimeout(() => {
          onChange(fileName);
        }, 100);
      }
    );
  }

  return {
    apply: "serve",
    name: servePluginName,

    buildStart() {
      workersByLinterName = createWorkerThreads(
        "serve",
        servePluginName,
        options.linters
      );
      for (const linterName of Object.keys(workersByLinterName)) {
        const worker = workersByLinterName[linterName];
        worker.on("message", (message) => onWorkerMessage(message, this));
      }

      const currentDirectory = process.cwd();

      watchDirectory(currentDirectory, this);

      if (includeMode === "filesInFolder") {
        lintFiles = readAllFiles(currentDirectory, fileFilter).map((f) =>
          normalizePath(f)
        );
        setTimeout(() => processFiles());
      }
    },

    configureServer(server: ViteDevServer) {
      devServer = server;

      devServer.middlewares.use(async (req, res, next) => {
        if (req.url === "/eslint.json") {
          const outputs: string[] = [];
          for (const linter of options.linters) {
            const output = await getFormattedOutput(linter);
            if (output) {
              outputs.push(output);
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.write(JSON.stringify(outputs), "utf-8");
          res.end();
        } else {
          next();
        }
      });
    },

    getLinter(name: string) {
      return options.linters.find((l) => l.name === name);
    },

    load(id) {
      const file = normalizePath(id);

      if (options.injectFile) {
        if (file === normalizePath(options.injectFile)) {
          const content = fs.readFileSync(id);
          return content + clientJs;
        }
      } else if (
        (injectedFile === null &&
          !file.startsWith("node_modules/") &&
          fs.existsSync(file)) ||
        file === injectedFile
      ) {
        injectedFile = file;
        const content = fs.readFileSync(id);
        return content + clientJs;
      }

      return null;
    },

    async transform(code, id) {
      if (!fileFilter(id) || includeMode === "filesInFolder") {
        return null;
      }

      const file = normalizePath(id);
      if (fs.existsSync(file)) {
        lintFiles.push(file);
      }

      const pluginContext = this;
      clearTimeout(processingTimeout);
      processingTimeout = setTimeout(
        () => processFiles().catch((ex) => pluginContext.error(ex)),
        1000
      );

      return null;
    },
  };
}
