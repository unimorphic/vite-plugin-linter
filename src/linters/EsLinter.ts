import { ESLint } from "eslint";
import fs from "fs";
import Linter, { LinterResult } from "../Linter";
import { normalizePath } from "../utils";

export interface EsLinterOptions extends ESLint.Options {
  /**
   * If the cache file should be removed before each start
   */
  clearCacheOnStart?: boolean;

  /**
   * Output formatter. Default is stylish
   */
  formatter?: string | ESLint.Formatter;
}

const defaultOptions: EsLinterOptions = {
  cache: true,
  cacheLocation: "./node_modules/.cache/.eslintcache",
  fix: false,
};

export default class EsLinter implements Linter<ESLint.LintResult> {
  public readonly name = "EsLinter";
  private readonly eslint: ESLint;
  private formatter: ESLint.Formatter | null = null;
  private readonly options: EsLinterOptions;

  constructor(options?: EsLinterOptions) {
    this.options = { ...defaultOptions, ...options };

    const { clearCacheOnStart, formatter, ...esLintOptions } = this.options;
    this.eslint = new ESLint(esLintOptions);

    if (clearCacheOnStart) {
      const cachePath = this.options.cacheLocation ?? ".eslintcache";
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    }
  }

  public async format(results: ESLint.LintResult[]): Promise<string> {
    if (!this.formatter) {
      await this.loadFormatter();
    }

    return this.formatter!.format(results);
  }

  public async lint(
    files: string[],
    output: (result: LinterResult<ESLint.LintResult>) => void
  ): Promise<void> {
    const lintFiles: string[] = [];
    for (const file of files) {
      if (!(await this.eslint.isPathIgnored(file))) {
        lintFiles.push(file);
      }
    }

    const reports = await this.eslint.lintFiles(lintFiles);

    if (this.options.fix && reports) {
      ESLint.outputFixes(reports);
    }

    const result: LinterResult<ESLint.LintResult> = {};
    for (const report of reports) {
      if (report.errorCount > 0 || report.warningCount > 0) {
        result[normalizePath(report.filePath)] = report;
      }
    }

    output(result);
  }

  private async loadFormatter(): Promise<void> {
    switch (typeof this.options.formatter) {
      case "string":
        this.formatter = await this.eslint.loadFormatter(
          this.options.formatter
        );
        break;
      case "function":
        this.formatter = this.options.formatter;
        break;
      default:
        this.formatter = await this.eslint.loadFormatter("stylish");
    }
  }
}
