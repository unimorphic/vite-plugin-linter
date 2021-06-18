import fs from "fs";
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

export function readAllFiles(
  folder: string,
  files: string[],
  extension: string
): void {
  const children = fs.readdirSync(folder, { withFileTypes: true });
  for (const child of children) {
    const childName = folder + "/" + child.name;
    if (child.isDirectory()) {
      readAllFiles(childName, files, extension);
    } else if (childName.endsWith(extension)) {
      files.push(childName);
    }
  }
}
