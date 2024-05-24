import eslint from '@eslint/js';
import globals from "globals";
import google from 'eslint-config-google';
import prettier from 'eslint-config-prettier';
import stylisticJs from '@stylistic/eslint-plugin-js'
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
{
  languageOptions: {
    globals: {
      ...globals.NodeJS,
      // replace with env: node in 9.x
    }
  },
  plugins: {
    '@stylistic/js': stylisticJs
  },
  rules: {
    ...google.rules,
    ...prettier.rules,

    "linebreak-style": "off",
    "object-curly-spacing": ["error", "always"],
    "max-len": ["error", { "code": 120 }],
    "indent": ["error", 2],
    "requireConfigFile": "off",
    "require-jsdoc": "off",
    // "quotes": ["error", "single"],
    // comma-dangle deprecated in favor of @stylistic/esline-plugin-us
    "comma-dangle": "off",
    "@stylistic/js/comma-dangle": [
      "error", {
        "arrays": "always-multiline",
        "objects": "always-multiline",
        "imports": "only-multiline",
        "exports": "never",
        "functions": "never"
    }],
    // "space-before-function-paren" was causing all kinds fo headaches because prettier won't honour it.
    "space-before-function-paren": "off",
    "operator-linebreak": ["error"],
    "semi-spacing": "off",
    "keyword-spacing": "error",
    "brace-style": "error",
    "arrow-spacing": "error",
    "sort-imports": "error",
    "sort-vars": "error",
    "sort-keys": "error",

    // We eventually want to disable no-explicit-any
    "no-extend-native": "warn",
    "guard-for-in": "off",
    "camelcase": "off",
    "new-cap": "error",
    "eol-last": ["error"],
    "semi": ["error"],
    "no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/ban-types": "off",
    "no-unused-vars": [
      "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_" 
        }
    ],
    // Off becuase it's already covered by no-unused-vars
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],
    // "react-hooks/rules-of-hooks": "error",
    // "react-hooks/exhaustive-deps": "warn"
  },
});
 