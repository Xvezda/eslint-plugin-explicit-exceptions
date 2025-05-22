"use strict";

const tseslint = require("typescript-eslint");
const eslintPlugin = require("./src/plugin");

module.exports = tseslint.config(
  tseslint.configs.recommendedTypeChecked,
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
    plugins: {
      example: eslintPlugin,
    },
    rules: {
      "example/no-undocumented-throws": "error",
      "example/no-implicit-propagation": ["error", { tabLength: 2 }],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);

