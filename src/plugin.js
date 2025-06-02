"use strict";

const plugin = {
  configs: {
    get recommendedTypeChecked() {
      return recommendedTypeChecked;
    },
  },
  rules: {
    'no-undocumented-throws': require('./rules/no-undocumented-throws'),
    'no-unhandled-rejection': require('./rules/no-unhandled-rejection'),
    'check-throws-tag-type': require('./rules/check-throws-tag-type'),
  },
};

const rules = /** @type {const} */({
  'explicit-exceptions/no-undocumented-throws': 'error',
  'explicit-exceptions/no-unhandled-rejection': 'error',
  'explicit-exceptions/check-throws-tag-type': 'error',
});

const recommendedTypeChecked = /** @type {const} */({
  plugins: {
    'explicit-exceptions': plugin,
  },
  rules, 
});

// Legacy config for backwards compatibility
Object.assign(plugin.configs, {
  'recommended-type-checked-legacy': {
    plugins: ['explicit-exceptions'],
    rules,
  },
});

module.exports = plugin;
