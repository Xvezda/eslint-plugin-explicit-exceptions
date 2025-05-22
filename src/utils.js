const { ESLintUtils } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/${name}.md`,
);

/** @param {string} comment */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} callback
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findParent = (node, callback) => {
  do {
    if (!node.parent) return null;

    node = node.parent;

    if (callback(node)) {
      return node;
    }
  } while (node);

  return null;
};

/**
 * @template {string} T
 * @template {readonly unknown[]} U
 * @param {import('@typescript-eslint/utils').TSESLint.RuleContext<T, U>} context
 * @returns {{ [K in keyof U[number]]: U[number][K] }}
 */
const getOptionsFromContext = (context) => {
  const options =
    /** @type {{ [K in keyof U[number]]: U[number][K] }} */
    (Object.assign(Object.create(null), ...context.options));

  return options;
};

module.exports = {
  createRule,
  hasThrowsTag,
  findParent,
  getOptionsFromContext,
};
