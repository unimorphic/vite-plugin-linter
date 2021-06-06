# vite-plugin-linter

Vite plugin to lint files and show the linter output in the Vite output and the browser console.
The main difference between this plugin and using similar Rollup plugins is that this plugin shows the output in the browser console.
Note this plugin is Vite only as it uses the Vite specific hook `configureServer`.

Included linters: ESLint & TypeScript


## Install

```
npm install vite-plugin-linter --save-dev
```


## Usage

```js
import { defineConfig } from "vite";
import { EsLinter, linterPlugin, TypeScriptLinter } from "vite-plugin-linter";

export default defineConfig((configEnv) => ({
  plugins: [
    linterPlugin({
      include: ["./src/**/*[.ts|.tsx]"],
      linters: [new EsLinter({ configEnv: configEnv }), new TypeScriptLinter()],
    }),
  ],
}));
```

## linterPlugin Options

### disableForBuild

- Type: `boolean`
- Default: `false`

If the plugin should not execute when called via the build command

### exclude

- Type: `String | RegExp | Array[...String|RegExp]`
- Default: `/node_modules/`

File(s) to exclude. A valid [picomatch](https://github.com/micromatch/picomatch#globbing-features) pattern, or array of patterns. Ex: `.\src\mine.ts`

### include

- Type: `String | RegExp | Array[...String|RegExp]`
- Default: `undefined`

File(s) to include. A valid [picomatch](https://github.com/micromatch/picomatch#globbing-features) pattern, or array of patterns. Ex: `.\src\**\*.ts`

### injectFile

- Type: `string`
- Default: The first file not in node_modules

File to inject the browser console logging code into

### linters

- Type: `Linter[]`
- Required

Linters to run


## EsLinter Options

### buildOptions

- Type: `EsLintOptions`
- Default: `cache: false, fix: false`

Options used when called via the build command

### configEnv

- Type: `ConfigEnv`
- Required

The current Vite configuration environment

### serveOptions

- Type: `EsLintOptions`
- Default: `cache: true, cacheLocation: "./node_modules/.cache/.eslintcache", fix: false`

Options used when called via the serve command


## EsLintOptions Type

This type extends [ESLint.Options](https://eslint.org/docs/developer-guide/nodejs-api#parameters) with the following additional members

### clearCacheOnStart

- Type: `boolean`
- Default: `false`

If the cache file should be removed before each start

### formatter

- Type: `string | ESLint.Formatter`
- Default: `stylish`

Output formatter https://eslint.org/docs/user-guide/formatters/


## Custom Linters

Custom linters can be created by extending the [Linter interface](https://bitbucket.org/unimorphic/vite-plugin-linter/src/master/src/Linter.ts)

See the included linters for examples https://bitbucket.org/unimorphic/vite-plugin-linter/src/master/src/linters/


## License

MIT
