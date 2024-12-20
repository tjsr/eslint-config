import eslint from '@eslint/js';
import globals from "globals";
import google from 'eslint-config-google';
import prettier from 'eslint-config-prettier';
import stylisticJs from '@stylistic/eslint-plugin-js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.NodeJS,
        // replace with env: node in 9.x
      },
    },
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    rules: {
      ...google.rules,
      ...prettier.rules,
      "@stylistic/js/comma-dangle": [
        "error", {
          "arrays": "always-multiline",
          "exports": "never",
          "functions": "never",
          "imports": "only-multiline",
          "objects": "always-multiline",
        }],
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
        },
      ],
      
      "arrow-spacing": "error",
      "brace-style": "error",
      "camelcase": "off",
      "comma-dangle": "off",
      "eol-last": ["error"],
      "guard-for-in": "off",
      "indent": ["error", 2],
      "keyword-spacing": "error",
      "linebreak-style": "off",
      "max-len": ["error", { "code": 120 }],
      "new-cap": "error",
      "no-explicit-any": "off",
      "no-extend-native": "warn",
      "no-unused-vars": "off", // Off - use @ts-es/nuv, see https://stackoverflow.com/a/61555310
      "object-curly-spacing": ["error", "always"],
      "operator-linebreak": ["error"],
      "require-jsdoc": "off",
      "requireConfigFile": "off",
      // "quotes": ["error", "single"],
      // comma-dangle deprecated in favor of @stylistic/esline-plugin-us
      // "space-before-function-paren" was causing all kinds fo headaches because prettier won't honour it.
      "semi": ["error"],
      "semi-spacing": "off",
      "sort-imports": "error",
      "sort-keys": ["error", "asc", { allowLineSeparatedGroups: true } ],
      "sort-vars": "error",
      "space-before-function-paren": "off",
      "valid-jsdoc": "off",

      // We eventually want to disable no-explicit-any
      // "react-hooks/rules-of-hooks": "error",
      // "react-hooks/exhaustive-deps": "warn"
    },
  },
  {
    "files": ["**/*.test.ts", "**/*.spec.test.ts", "**'*.spec.ts"],
    rules: {
      "max-len": "off",
    }
  });
 
