"use strict";

const path = require("path");
const tseslint = require("typescript-eslint");
const eslintPlugin = require("../src/plugin");

module.exports = tseslint.config(
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: path.resolve(__dirname, '..'),
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    plugins: {
      'explicit-exceptions': eslintPlugin,
    },
    rules: {
      "explicit-exceptions/no-implicit-propagation": ["error", { tabLength: 2 }],
    },
  },
);

