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

## Shared Prettier

Projects that already use this package can use the same formatter without
listing Prettier or its plugins separately. For standard formatting, create
`prettier.config.mjs`:

```js
export { default } from '@tjsr/eslint-config/prettier.mjs';
```

Where alphabetical sorting of TypeScript members is already wanted, use
`@tjsr/eslint-config/prettier-sort-members.mjs` instead. This sorts members,
not imports. The separate `@tjsr/eslint-config/prettier-sort-imports.mjs`
config is opt-in for projects that already use Prettier to sort imports; the
standard config leaves ordering to ESLint.

In npm scripts, use `tjsr-prettier` to run the version supplied by this
package (for example, `tjsr-prettier --check src`). The same package owns both
plugin versions, so consumer lockfiles pick them up with the ESLint config.
