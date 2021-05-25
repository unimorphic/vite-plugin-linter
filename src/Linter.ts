export type LinterResult<T> = { [file: string]: T } | undefined;

export default interface Linter<T> {
  name: string;
  format(results: T[]): Promise<string>;
  lint(files: string[], output: (result: LinterResult<T>) => void): void;
}
