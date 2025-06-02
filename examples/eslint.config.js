"use strict";

const tseslint = require("typescript-eslint");
const eslintPlugin = require("../src/plugin");

module.exports = tseslint.config(
  tseslint.configs.recommendedTypeChecked,
  eslintPlugin.configs.recommendedTypeChecked,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);

