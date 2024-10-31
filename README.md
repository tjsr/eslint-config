# eslint-config

Personal eslint configuration settings to minimize eslint configs.

## Usage

Remember that using `ignores` within an eslint config block with any other keys will only apply that ignore block to config options within that block.  For `ignores` to be applied globally or to all files within the project, `ignores` must be the only key in a config array element.

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
