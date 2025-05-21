"use strict";

module.exports = /** @type {import('eslint').ESLint.Plugin} */({
  meta: {},
  rules: {
    'exception-documentation': require('./rules/exception-documentation'),
    'no-implicit-propagation': require('./rules/no-implicit-propagation'),
  },
});
