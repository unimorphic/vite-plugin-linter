import { ESLint } from "eslint";
import Linter, { LinterResult } from "../Linter";
import { normalizePath } from "../utils";

export interface EsLinterOptions {
  cache?: boolean;
  fix?: boolean;
  formatter?: string | ESLint.Formatter;
}

export default class EsLinter implements Linter<ESLint.LintResult> {
  public readonly name = "EsLinter";
  private readonly eslint: ESLint;
  private formatter: ESLint.Formatter | null = null;
  private readonly options: EsLinterOptions;

  constructor(options?: EsLinterOptions) {
    const defaultOptions: EsLinterOptions = { cache: true, fix: false };
    this.options = { ...defaultOptions, ...options };
    this.eslint = new ESLint({
      cache: this.options.cache,
      fix: this.options.fix,
    });
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
