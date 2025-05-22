"use strict";

const plugin = {
  configs: {
    get recommendedTypeChecked() {
      return recommendedTypeChecked;
    },
  },
  rules: {
    'no-undocumented-throws': require('./rules/no-undocumented-throws'),
    'no-implicit-propagation': require('./rules/no-implicit-propagation'),
  },
};

const recommendedTypeChecked = /** @type {const} */({
  plugins: {
    'explicit-exceptions': plugin,
  },
  rules: {
    'explicit-exceptions/no-undocumented-throws': 'error',
    'explicit-exceptions/no-implicit-propagation': 'error',
  }
});

module.exports = plugin;
