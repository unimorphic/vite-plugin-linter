#!/usr/bin/env node
import { resolveConfig } from "vite";
import { buildPluginName, LinterBuildPlugin } from "./linterPluginBuild";

export default async function lint(): Promise<void> {
  const config = await resolveConfig({}, "build");
  const plugin = config.plugins.find((p) => p.name === buildPluginName);

  if (!plugin) {
    throw new Error(`Could not find plugin ${buildPluginName}`);
  }

  const outputLines = await (plugin as LinterBuildPlugin).lintFolder(
    process.cwd()
  );
  if (outputLines.length > 0) {
    for (const output of outputLines) {
      console.warn(output);
    }
    console.error("Linting failed, see above output");
    process.exit(1);
  }
}

global.vitePluginLinter = { mode: "lintCommand" };
lint();
