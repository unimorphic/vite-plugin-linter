import { ESLint } from "eslint";

declare module "eslint" {
  function loadESLint(): Promise<typeof ESLint>;
}
