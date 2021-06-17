import { createFilter } from "@rollup/pluginutils";
import fs from "fs";
import { PluginContext } from "rollup";
import { Plugin, ViteDevServer } from "vite";
import Linter from "./Linter";
import { LinterPluginOptions, LinterResultData } from "./linterPlugin";
import { normalizePath } from "./utils";

const eventName = "eslint-warn";

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

    import.meta.hot.on("${eventName}", d => console.warn(d));
  }
`;

export default function linterPluginServe(
  options: LinterPluginOptions = {} as LinterPluginOptions,
  filter: (id: string | unknown) => boolean
): Plugin {
  let devServer: ViteDevServer | null = null;
  let processingFiles: string[] = [];
  let processingTimeout: NodeJS.Timeout;
  let injectedFile: string | null = null;

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

  async function processFiles(pluginContext: PluginContext): Promise<void> {
    const files = [...processingFiles];
    processingFiles = [];

    for (const linter of options.linters) {
      linter.lintServe(files, async (result) => {
        if (!result) {
          return;
        }

        const dataByFileName = dataByFileNameByLinterName[linter.name];

        for (const file of files) {
          if (file in result) {
            dataByFileName[file] = result[file];
          } else if (file in dataByFileName) {
            delete dataByFileName[file];
          }
        }

        const output = await getFormattedOutput(linter);
        if (output) {
          pluginContext.warn(output);

          if (devServer) {
            devServer.ws.send({
              event: eventName,
              data: output,
              type: "custom",
            });
          }
        }
      });
    }
  }

  return {
    apply: "serve",
    name: "vite-plugin-linter-serve",

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
      if (!filter(id)) {
        return null;
      }

      clearTimeout(processingTimeout);
      
      const file = normalizePath(id);
      if (fs.existsSync(file)) {
        processingFiles.push(file);
      }

      const pluginContext = this;
      processingTimeout = setTimeout(
        () =>
          processFiles(pluginContext).catch((ex) => pluginContext.error(ex)),
        1000
      );

      return null;
    },
  };
}
