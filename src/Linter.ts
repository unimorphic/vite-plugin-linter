export type LinterResult<T> = { [file: string]: T } | undefined;

export default interface Linter<T> {
  /**
   * Name of the linter. Must be unique
   */
  name: string;

  /**
   * Format the output for displaying to the user
   * @param results Linting results to format
   */
  format(results: readonly T[]): Promise<string>;

  /**
   * Lint files during the build command
   * @param files Files to lint
   */
  lintBuild(files: string[]): Promise<readonly T[]>;

  /**
   * Lint files during the serve command
   * @param files Files to lint
   * @param output Call when results from linting are available
   */
  lintServe(files: string[], output: (result: LinterResult<T>) => void): void;
}
