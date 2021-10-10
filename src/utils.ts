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
  filter: (fileName: string) => boolean
): string[] {
  let files: string[] = [];
  const children = fs.readdirSync(folder, { withFileTypes: true });
  for (const child of children) {
    const childName = folder + "/" + child.name;
    if (child.isDirectory()) {
      files = files.concat(readAllFiles(childName, filter));
    } else if (filter(childName)) {
      files.push(childName);
    }
  }

  return files;
}
