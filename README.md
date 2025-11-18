# eslint-config

Personal eslint configuration settings to minimize eslint configs.

## Installation

To install,

```shell
npm i -D @tjsr/eslint-config@github:tjsr/eslint-config#main
npm i -D eslint
```

## Usage

Remember that using `ignores` within an eslint config block with any other keys will only apply that ignore block to config options within that block.  For `ignores` to be applied globally or to all files within the project, `ignores` must be the only key in a config array element.

The below is an eslint.config.mts file you should use by default:

```js
export default tseslint.config(
{
  ignores: ['dist'],
},
{
  extends: [
    ...tjsrEslintConfig,
  ],
  files: ["src/**/*.ts"],
  languageOptions: {
    globals:{
      es2021: true,
      node: true,
    },
  },
});
```

Then, add the following run target to `package.json`:

```json
"scripts":
// ...
  "lint": "eslint",
// ...
}
```
