"use strict";

const tseslint = require("typescript-eslint");
const plugin = require("./src/plugin");

module.exports = tseslint.config(
  tseslint.configs.recommendedTypeChecked,
  plugin.configs.recommendedTypeChecked,
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
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);

