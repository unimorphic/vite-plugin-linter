import path from "path";

export function normalizePath(id: string): string {
  return path.relative(process.cwd(), id).split(path.sep).join("/");
}

export function onlyUnique(
  value: string,
  index: number,
  self: string[]
): boolean {
  return self.indexOf(value) === index;
}
