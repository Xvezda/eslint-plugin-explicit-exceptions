"use strict";

module.exports = {
  rules: {
    'exception-documentation': require('./rules/exception-documentation'),
    'no-implicit-propagation': require('./rules/no-implicit-propagation'),
  },
};
