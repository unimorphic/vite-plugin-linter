import fs from "fs";
import path from "path";
import ts from "typescript";
import Linter, { LinterResult } from "../Linter";
import { normalizePath, onlyUnique, readAllFiles } from "../utils";

export interface TypeScriptLinterOptions extends ts.CompilerOptions {
  /**
   * Path to the TypeScript config file. Defaults to tsconfig.json
   */
  configFilePath?: string;
}

const defaultOptions: TypeScriptLinterOptions = {
  configFilePath: "tsconfig.json",
  noEmit: true,
};

export default class TypeScriptLinter implements Linter<ts.Diagnostic> {
  public readonly name = "TypeScriptLinter";
  private formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: process.cwd,
    getNewLine: () => "\n",
  };
  private options: TypeScriptLinterOptions;
  private optionsLoadedFromFile = false;
  private watchingFiles: string[] = [];
  private watcher: ts.WatchOfFilesAndCompilerOptions<ts.BuilderProgram> | null =
    null;

  constructor(options?: TypeScriptLinterOptions) {
    this.options = { ...defaultOptions, ...options };
  }

  public async format(results: ts.Diagnostic[]): Promise<string> {
    return ts.formatDiagnosticsWithColorAndContext(results, this.formatHost);
  }

  public async lintBuild(files: string[]): Promise<readonly ts.Diagnostic[]> {
    if (!this.optionsLoadedFromFile) {
      this.loadOptions();
    }

    const allFiles = files.concat(this.getCustomTypeRootFiles());

    const program = ts.createProgram(allFiles, this.options);
    return ts.getPreEmitDiagnostics(program);
  }

  public lintServe(
    files: string[],
    output: (result: LinterResult<ts.Diagnostic>) => void
  ): void {
    if (!this.optionsLoadedFromFile) {
      this.loadOptions();

      this.watchingFiles = this.watchingFiles.concat(
        this.getCustomTypeRootFiles()
      );
    }

    if (files.some((f) => !this.watchingFiles.includes(f))) {
      this.watchingFiles = this.watchingFiles.concat(files).filter(onlyUnique);

      if (this.watcher) {
        this.watcher.close();
      }

      const host = ts.createWatchCompilerHost(
        this.watchingFiles,
        this.options,
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
        (diagnostic, newLine, options, errorCount) => {
          if (errorCount !== undefined && errorCount <= 0) {
            output({});
          }
        }
      );
      this.watcher = ts.createWatchProgram(host);
    }
  }

  // Fix for ts api not respecting typeRoots option
  private getCustomTypeRootFiles(): string[] {
    let files: string[] = [];
    if (this.options.typeRoots) {
      for (const root of this.options.typeRoots) {
        if (!root.includes("node_modules")) {
          files = files.concat(readAllFiles(root, (f) => f.endsWith(".d.ts")));
        }
      }
    }
    return files;
  }

  private loadOptions(): void {
    this.optionsLoadedFromFile = true;

    if (!this.options.configFilePath) {
      return;
    }

    const configPath = path.resolve(process.cwd(), this.options.configFilePath);
    const configContents = fs.readFileSync(configPath).toString();

    const configResult = ts.parseConfigFileTextToJson(
      configPath,
      configContents
    );
    const compilerOptions = ts.convertCompilerOptionsFromJson(
      configResult.config["compilerOptions"] || {},
      process.cwd()
    );

    this.options = { ...compilerOptions.options, ...this.options };
  }
}
