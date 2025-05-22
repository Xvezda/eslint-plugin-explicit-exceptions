"use strict";

const fs = require('fs');
const path = require('path');

/** @type {Record<string, unknown>} */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
);

// @ts-expect-error createRule unmatch
module.exports = /** @type {import('eslint').ESLint.Plugin} */({
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules: {
    'no-undocumented-throws': require('./rules/no-undocumented-throws'),
    'no-implicit-propagation': require('./rules/no-implicit-propagation'),
  },
});
