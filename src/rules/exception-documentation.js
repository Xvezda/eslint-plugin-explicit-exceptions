// @ts-check
const toolkit = require('estree-toolkit');
const { hasThrowsTag } = require('../utils');

module.exports = /** @type {import('eslint').Rule.RuleModule} */({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Explicitly document exceptions thrown by functions',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      missingThrowsTag: 'Missing @throws (or @exception) tag in JSDoc comment.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        // @ts-ignore
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
        const functionDeclarationNode =
          /** @type {import('estree-toolkit').types.FunctionDeclaration} */
          (functionDeclarationPath.node);

        const comments = sourceCode
          .getCommentsBefore(functionDeclarationNode);

        const isCommented = 
          comments.length &&
          comments
            .map(({ value }) => value)
            .some(hasThrowsTag);

        if (!isCommented) {
          context.report({
            node: functionDeclarationNode,
            messageId: 'missingThrowsTag',
            fix(fixer) {
              return fixer
                .insertTextBefore(
                  functionDeclarationNode,
                  // TODO: Grab exact type of thrown exception
                  '/**\n * @throws {Error}\n */\n'
                );
            },
          });
        }
      }
    },
  });
}

