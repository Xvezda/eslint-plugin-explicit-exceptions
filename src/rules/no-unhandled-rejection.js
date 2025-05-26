// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const {
  createRule,
  hasJSDocThrowsTag,
  findIdentifierDeclaration,
  isInAsyncHandledContext,
} = require('../utils');

module.exports = createRule({
  name: 'no-unhandled-rejection',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unhandled promise rejections',
    },
    messages: {
      unhandledRejection: 'Unhandled promise rejection detected. Use `.catch()` or `async/await` to handle it.',
    },
    schema: [],
  },
  defaultOptions: [],

  create(context) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node */
      'CallExpression[callee.type="Identifier"]'(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;

        const calleeDeclaration = findIdentifierDeclaration(
          sourceCode,
          node.callee,
        );
        if (!calleeDeclaration) return;

        if (!hasJSDocThrowsTag(sourceCode, calleeDeclaration)) return;

        /** @type {ReturnType<typeof sourceCode.getScope> | null} */
        let scope = sourceCode.getScope(node.callee);
        do {
          if (scope.set.has(node.callee.name)) break;
          scope = scope.upper;
        } while (scope);

        if (!scope) return;

        const references = scope.set.get(node.callee.name)?.references;
        references?.forEach(reference => {
          if (!isInAsyncHandledContext(sourceCode, reference.identifier)) {
            context.report({
              node: reference.identifier,
              messageId: 'unhandledRejection',
            });
          }
        });
      },
    };
  },
});
