import { ESLint, loadESLint } from "eslint";
import fs from "fs";
import { ConfigEnv } from "vite";
import Linter, { LinterResult } from "../Linter";
import { normalizePath } from "../utils";

export interface EsLinterOptions {
  /**
   * Options used when called via the build command.
   * Defaults: cache: false, fix: false
   */
  buildOptions?: EsLintOptions;

  /**
   * The current Vite configuration environment
   */
  configEnv: ConfigEnv;

  /**
   * Options used when called via the serve command.
   * Defaults: cache: true, cacheLocation: "./node_modules/.cache/.eslintcache", fix: false
   */
  serveOptions?: EsLintOptions;
}

export interface EsLintOptions extends ESLint.Options {
  /**
   * If the cache file should be removed before each start
   */
  clearCacheOnStart?: boolean;

  /**
   * Output formatter. Default is stylish
   */
  formatter?: string | ESLint.Formatter;
}

const defaultBuildOptions: EsLintOptions = {
  cache: false,
  fix: false,
};

const defaultServeOptions: EsLintOptions = {
  cache: true,
  cacheLocation: "./node_modules/.cache/.eslintcache",
  fix: false,
};

export default class EsLinter implements Linter<ESLint.LintResult> {
  public readonly name = "EsLinter";
  private eslint: ESLint | null = null;
  private formatter: ESLint.Formatter | null = null;
  private readonly options: EsLintOptions;

  constructor(options?: EsLinterOptions) {
    if (options?.configEnv.command === "build") {
      this.options = { ...defaultBuildOptions, ...options.buildOptions };
    } else {
      this.options = { ...defaultServeOptions, ...options?.serveOptions };
    }

    if (this.options.clearCacheOnStart) {
      const cachePath = this.options.cacheLocation ?? ".eslintcache";
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    }
  }

  public async format(results: ESLint.LintResult[]): Promise<string> {
    if (!this.eslint) {
      await this.loadLinter();
    }
    if (!this.formatter) {
      await this.loadFormatter();
    }

    return this.formatter!.format(results);
  }

  public async lintBuild(files: string[]): Promise<ESLint.LintResult[]> {
    return await this.lint(files);
  }

  public async lintServe(
    files: string[],
    output: (result: LinterResult<ESLint.LintResult>) => void
  ): Promise<void> {
    const reports = await this.lint(files);

    const result: LinterResult<ESLint.LintResult> = {};
    for (const report of reports) {
      if (report.errorCount > 0 || report.warningCount > 0) {
        result[normalizePath(report.filePath)] = report;
      }
    }

    output(result);
  }

  private async lint(files: string[]): Promise<ESLint.LintResult[]> {
    if (!this.eslint) {
      await this.loadLinter();
    }

    const lintFiles: string[] = [];
    for (const file of files) {
      if (!(await this.eslint!.isPathIgnored(file))) {
        lintFiles.push(file);
      }
    }

    const reports = await this.eslint!.lintFiles(lintFiles);

    if (this.options.fix && reports) {
      ESLint.outputFixes(reports);
    }

    return reports;
  }

  private async loadLinter(): Promise<void> {
    const { clearCacheOnStart, formatter, ...esLintOptions } = this.options;

    const esLint = await loadESLint();
    this.eslint = new esLint(esLintOptions);
  }

  private async loadFormatter(): Promise<void> {
    switch (typeof this.options.formatter) {
      case "string":
        this.formatter = await this.eslint!.loadFormatter(
          this.options.formatter
        );
        break;
      case "function":
        this.formatter = this.options.formatter;
        break;
      default:
        this.formatter = await this.eslint!.loadFormatter("stylish");
    }
  }
}
