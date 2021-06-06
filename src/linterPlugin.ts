import { createFilter, FilterPattern } from "@rollup/pluginutils";
import { Plugin } from "vite";
import Linter from "./Linter";
import linterPluginBuild from "./linterPluginBuild";
import linterPluginServe from "./linterPluginServe";

export interface LinterPluginOptions {
  /**
   * If the plugin should not execute when called via the build command
   */
  disableForBuild?: boolean;

  /**
   * File(s) to exclude. Defaults to /node_modules/ (Ex: .\src\mine.ts)
   */
  exclude?: FilterPattern;

  /**
   * File(s) to include. (Ex: .\src\**\*.ts)
   */
  include?: FilterPattern;

  /**
   * File to inject the browser console logging code into. Defaults to the first file not in node_modules
   */
  injectFile?: string;

  /**
   * Linters to run
   */
  linters: Linter<LinterResultData>[];
}

export type LinterResultData = any;

export default function linterPlugin(
  options: LinterPluginOptions = {} as LinterPluginOptions
): Plugin[] {
  const filter = createFilter(
    options.include,
    options.exclude || /node_modules/
  );

  const plugins = [linterPluginServe(options, filter)];
  if (!options.disableForBuild) {
    plugins.push(linterPluginBuild(options, filter));
  }

  return plugins;
}
