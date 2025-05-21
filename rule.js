const { traverse, utils: u, builders: b, is } = require('estree-toolkit');

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
    const sourceCode = context.sourceCode;

    return {
      Program(node) {
        traverse(node, {
          ThrowStatement(path) {
            const parentFunctionDeclaration =
              path.findParent(is.functionDeclaration);

            if (parentFunctionDeclaration) {
              const comments = sourceCode
                .getCommentsBefore(parentFunctionDeclaration.node);

              const hasThrowsTag = 
                comments.length &&
                comments.some(comment => {
                  return comment.value.includes('@throws') ||
                    comment.value.includes('@exception');
                });

              if (!hasThrowsTag) {
                context.report({
                  node: parentFunctionDeclaration.node,
                  message: 'This is a custom ESLint rule.',
                  fix(fixer) {
                    return fixer
                      .insertTextBefore(
                        parentFunctionDeclaration.node,
                        '/**\n * @throws {Error}\n */\n'
                      );
                  },
                });
              }
            }
          }
        });
      },
    };
  }
});
