import fs from "fs";
import path from "path";
import ts from "typescript";
import Linter, { LinterResult } from "../Linter";
import { normalizePath, onlyUnique } from "../utils";

export default class TypeScriptLinter implements Linter<ts.Diagnostic> {
  public readonly name = "TypeScriptLinter";
  private formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: process.cwd,
    getNewLine: () => "\n",
  };
  private options: ts.CompilerOptions | null = null;
  private watchingFiles: string[] = [];
  private watcher: ts.WatchOfFilesAndCompilerOptions<ts.BuilderProgram> | null =
    null;

  public async format(results: ts.Diagnostic[]): Promise<string> {
    return ts.formatDiagnosticsWithColorAndContext(results, this.formatHost);
  }

  public async lintBuild(files: string[]): Promise<readonly ts.Diagnostic[]> {
    if (!this.options) {
      this.loadOptions();
    }

    const program = ts.createProgram(files, this.options!);
    return ts.getPreEmitDiagnostics(program);
  }

  public lintServe(
    files: string[],
    output: (result: LinterResult<ts.Diagnostic>) => void
  ): void {
    if (!this.options) {
      this.loadOptions();
    }

    if (files.some((f) => !this.watchingFiles.includes(f))) {
      this.watchingFiles = this.watchingFiles.concat(files).filter(onlyUnique);

      if (!this.watcher) {
        // Delay the creation so other linters aren't delayed
        setTimeout(() => {
          const host = ts.createWatchCompilerHost(
            this.watchingFiles,
            this.options!,
            ts.sys,
            undefined,
            (diagnostic) => {
              if (
                diagnostic.category !== ts.DiagnosticCategory.Message &&
                diagnostic.file
              ) {
                output({
                  [normalizePath(diagnostic.file.fileName)]: diagnostic,
                });
              }
            },
            () => {}
          );
          this.watcher = ts.createWatchProgram(host);
        });
      } else {
        this.watcher.updateRootFileNames(this.watchingFiles);
      }
    }
  }

  private loadOptions(): void {
    const configPath = path.resolve(process.cwd(), "tsconfig.json");
    const configContents = fs.readFileSync(configPath).toString();

    const configResult = ts.parseConfigFileTextToJson(
      configPath,
      configContents
    );
    const settings = ts.convertCompilerOptionsFromJson(
      configResult.config["compilerOptions"] || {},
      process.cwd()
    );
    settings.options.noEmit = true;

    this.options = settings.options;
  }
}
