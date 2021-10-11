import path from "path";
import { resolveConfig } from "vite";
import { parentPort, Worker, workerData } from "worker_threads";
import Linter, { LinterResult } from "./Linter";
import { LinterPluginBase, LinterResultData } from "./linterPlugin";

interface WorkerThreadData {
  command: "build" | "serve";
  linterName: string;
  pluginName: string;
  workingDirectory: string;
}

export interface WorkerThreadMessage {
  files: string[];
  linterName: string;
  result: {
    build?: readonly LinterResultData[];
    serve?: LinterResult<LinterResultData>;
  };
}

export function createWorkerThreads(
  command: "build" | "serve",
  pluginName: string,
  linters: Linter<LinterResultData>[]
): { [linterName: string]: Worker } {
  let workersByLinterName: { [linterName: string]: Worker } = {};
  for (const linter of linters) {
    const data: WorkerThreadData = {
      command: command,
      linterName: linter.name,
      pluginName: pluginName,
      workingDirectory: process.cwd(),
    };

    workersByLinterName[linter.name] = new Worker(
      path.join(__dirname, "lintWorkerThread.js"),
      { workerData: data }
    );
  }

  return workersByLinterName;
}

async function init(data: WorkerThreadData): Promise<void> {
  const config = await resolveConfig(
    { root: data.workingDirectory },
    data.command
  );

  const plugin = config.plugins.find((p) => p.name === data.pluginName);
  if (!plugin) {
    throw new Error(`Could not find plugin ${data.pluginName}`);
  }

  const linter = (plugin as LinterPluginBase).getLinter(data.linterName);
  if (!linter) {
    throw new Error(`Could not find linter ${data.linterName}`);
  }

  parentPort!.on("message", async (files: string[]) => {
    switch (data.command) {
      case "build":
        const buildResult = await linter.lintBuild(files);
        const buildMessage: WorkerThreadMessage = {
          files: files,
          linterName: data.linterName,
          result: { build: buildResult },
        };
        parentPort!.postMessage(buildMessage);
        break;

      case "serve":
        linter.lintServe(files, (serveResult) => {
          if (serveResult) {
            const serveMessage: WorkerThreadMessage = {
              files: files,
              linterName: data.linterName,
              result: { serve: serveResult },
            };
            parentPort!.postMessage(serveMessage);
          }
        });
        break;

      default:
        throw new Error(`Uknown command ${data.command}`);
    }
  });
}

if (workerData) {
  init(workerData as WorkerThreadData);
}
