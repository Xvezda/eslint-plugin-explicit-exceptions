const toolkit = require('estree-toolkit');

module.exports = /** @type {import('eslint').Rule.RuleModule} */({
  meta: {
    type: 'problem',
    docs: {
      description: 'A custom ESLint rule',
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        _traverse(node, context);
      },
    };
  }
});

/**
 * @param {import('eslint').Rule.Node} node
 * @param {import('eslint').Rule.RuleContext} context
 */
function _traverse(node, context) {
  const { traverse, utils: u, builders: b, is } = toolkit;
  const sourceCode = context.sourceCode;

  traverse(node, {
    ThrowStatement(path) {
      const functionDeclarationPath =
        path.findParent(is.functionDeclaration);

      if (functionDeclarationPath) {
        const functionDeclarationNode = functionDeclarationPath.node

        const comments = sourceCode
          .getCommentsBefore(functionDeclarationNode);

        const hasThrowsTag = 
          comments.length &&
          comments.some(comment =>
            comment.value.includes('@throws') ||
            comment.value.includes('@exception')
          );

        if (!hasThrowsTag) {
          context.report({
            node: functionDeclarationNode,
            message: 'This is a custom ESLint rule.',
            fix(fixer) {
              return fixer
                .insertTextBefore(
                  functionDeclarationNode,
                  '/**\n * @throws {Error}\n */\n'
                );
            },
          });
        }
      }
    }
  });
}
