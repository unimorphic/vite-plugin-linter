import path from "path";
import { fileURLToPath } from "url";
import { resolveConfig } from "vite";
import { parentPort, Worker, workerData } from "worker_threads";
import Linter, { LinterResult } from "./Linter";
import { LinterPluginBase, LinterResultData } from "./linterPlugin";

interface FunctionInfo {
  function: unknown;
  key: string;
  source: Record<string, unknown>;
}

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
      fileURLToPath(import.meta.url),
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

        const functions = removeFunctionsFromObject(buildMessage);
        parentPort!.postMessage(buildMessage);
        restoreFunctionsToObject(buildMessage, functions);
        break;

      case "serve":
        linter.lintServe(files, (serveResult) => {
          if (serveResult) {
            const serveMessage: WorkerThreadMessage = {
              files: files,
              linterName: data.linterName,
              result: { serve: serveResult },
            };

            const functions = removeFunctionsFromObject(serveMessage);
            parentPort!.postMessage(serveMessage);
            restoreFunctionsToObject(serveMessage, functions);
          }
        });
        break;

      default:
        throw new Error(`Uknown command ${data.command}`);
    }
  });
}

function removeFunctionsFromObject(
  object: object,
  maxDepth = 10
): FunctionInfo[] {
  const record = object as Record<string, unknown>;
  const functions: FunctionInfo[] = [];

  for (const key of Object.keys(record)) {
    if (typeof record[key] === "function") {
      functions.push({ function: record[key], key: key, source: record });
      delete record[key];
    } else if (
      typeof record[key] === typeof object &&
      record[key] !== null &&
      maxDepth > 0
    ) {
      functions.push(
        ...removeFunctionsFromObject(record[key] as object, maxDepth - 1)
      );
    }
  }

  return functions;
}

function restoreFunctionsToObject(
  object: object,
  functions: FunctionInfo[],
  maxDepth = 10
): void {
  const record = object as Record<string, unknown>;

  const functionInfos = functions.filter((f) => f.source === record);
  for (const functionInfo of functionInfos) {
    record[functionInfo.key] = functionInfo.function;
  }

  for (const key of Object.keys(record)) {
    if (
      typeof record[key] === typeof object &&
      record[key] !== null &&
      maxDepth > 0
    ) {
      restoreFunctionsToObject(record[key] as object, functions, maxDepth - 1);
    }
  }
}

if (workerData) {
  init(workerData as WorkerThreadData);
}
