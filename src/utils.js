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

module.exports = {
  hasThrowsTag,
  findParent,
};
