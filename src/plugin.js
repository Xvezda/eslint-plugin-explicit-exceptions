"use strict";

const fs = require('fs');
const path = require('path');
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
);

// @ts-expect-error
module.exports = /** @type {import('eslint').ESLint.Plugin} */({
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules: {
    'exception-documentation': require('./rules/exception-documentation'),
    'no-implicit-propagation': require('./rules/no-implicit-propagation'),
  },
});
