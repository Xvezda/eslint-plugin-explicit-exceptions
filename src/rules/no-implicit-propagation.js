// @ts-check
const toolkit = require('estree-toolkit');

/** @param {string} comment */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

module.exports = /** @type {import('eslint').Rule.RuleModule} */({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Explicitly document exceptions thrown by functions and do not allows implicit propagation of exceptions.',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      missingThrowsTag: 'Missing @throws (or @exception) tag in JSDoc comment.',
      implicitPropagation:
        'Implicit propagation of exceptions is not allowed. Use try/catch to handle exceptions.',
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
    $: { scope: true },
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
    CallExpression(path) {
      if (!path.node || !path.scope) return;

      if (is.identifier(path.node.callee)) {
        const binding = path.scope.getBinding(path.node.callee.name);
        if (
          !binding ||
          !is.functionDeclaration(binding.path.node)
        ) return;

        const comments = sourceCode
          .getCommentsBefore(binding.path.node)
          .map(({ value }) => value);

        if (
          comments.some(hasThrowsTag) &&
          path.findParent(is.tryStatement) === null
        ) {
          const expressionStatement = path.findParent(is.expressionStatement);
          if (!expressionStatement || !expressionStatement.node) return;

          const expressionStatementNode = 
            /** @type {import('estree-toolkit').types.BlockStatement} */
            (expressionStatement.node);

          context.report({
            node: expressionStatementNode,
            messageId: 'implicitPropagation',
            fix(fixer) {
              // TODO: Apply proper indentation?
              return fixer.replaceText(
                expressionStatementNode,
                `try {\n    ${sourceCode.getText(expressionStatementNode)}\n  } catch {}`,
              );
            },
          });
        }
      }
    },
  });
}

