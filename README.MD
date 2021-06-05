# vite-plugin-linter

Vite plugin to lint files and show the linter output in the Vite output and the browser console.
The main difference between this plugin and using similar Rollup plugins is that this plugin shows the output in the browser console.
Note this plugin is Vite only as it uses the Vite specific hook `configureServer`.

Included linters: ESLint & TypeScript

Custom linters can be created by extending the Linter interface

## Install

```
npm install vite-plugin-linter --save-dev
```

## Usage

```js
import { defineConfig } from "vite";
import { EsLinter, linterPlugin, TypeScriptLinter } from "vite-plugin-linter";

export default defineConfig({
  plugins: [
    linterPlugin({
      include: ["./src/**/*[.ts|.tsx]"],
      linters: [new EsLinter(), new TypeScriptLinter()],
    }),
  ],
});
```

## Options

### `exclude`

- Type: `FilterPattern`
- Default: `/node_modules/`

File(s) to exclude. Ex: `.\src\**\*.ts`

### `include`

- Type: `FilterPattern`
- Default: `undefined`

File(s) to include. Ex: `.\src\**\*.ts`

### `injectFile`

- Type: `string`
- Default: The first file not in node_modules

File to inject the logging code into

### `linters`

- Type: `Linter[]`
- Required

Linters to run

## License

MIT
