import { createFilter, FilterPattern } from "@rollup/pluginutils";
import { Plugin } from "vite";
import Linter from "./Linter";
import linterPluginBuild from "./linterPluginBuild";
import linterPluginServe from "./linterPluginServe";

export type IncludeMode = "processedFiles" | "filesInFolder";

export interface LinterPluginOptions {
  /**
   * Options used when called via the build command
   */
  build?: {
    /**
     * If the plugin should not execute when called via the build command
     */
    disable?: boolean;

    /**
     * Which files to lint when called via the build command
     * processedFiles lints only the files processed by Vite (default)
     * filesInFolder lints all files in the project folder
     */
    includeMode?: IncludeMode;
  };

  /**
   * Options used when called via the serve command
   */
  serve?: {
    /**
     * If the plugin should not execute when called via the serve command
     */
    disable?: boolean;

    /**
     * Which files to lint when called via the serve command
     * processedFiles lints only the files processed by Vite (default)
     * filesInFolder lints all files in the project folder
     */
    includeMode?: IncludeMode;
  };

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
  const fileFilter = createFilter(
    options.include,
    options.exclude ?? /node_modules/
  );

  const plugins = [];
  
  if (!options.serve?.disable) {
    plugins.push(linterPluginServe(options, fileFilter));
  }
  if (!options.build?.disable) {
    plugins.push(linterPluginBuild(options, fileFilter));
  }

  return plugins;
}
