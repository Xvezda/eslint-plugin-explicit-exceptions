// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const {
  createRule,
  getNodeID,
  getCalleeDeclaration,
  isInAsyncHandledContext,
  getJSDocThrowsTagTypes,
  findClosest,
} = require('../utils');


module.exports = createRule({
  name: 'no-unhandled-rejection',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unhandled promise rejections',
    },
    messages: {
      unhandledRejection:
        'Unhandled promise rejection detected. Use `.catch()` or `async/await` to handle it.',
    },
    schema: [],
  },
  defaultOptions: [],

  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;

    /** @type {Set<string>} */
    const visitedNodes = new Set();

    return {
      Identifier(node) {
        const expression =
          /** @type {import('@typescript-eslint/utils').TSESTree.Expression} */
          (findClosest(node, (n) =>
            n.type === AST_NODE_TYPES.MemberExpression ||
            n.type === AST_NODE_TYPES.CallExpression
          ));

        if (!expression) return;

        if (visitedNodes.has(getNodeID(expression))) return;
        visitedNodes.add(getNodeID(expression));

        const calleeDeclaration = getCalleeDeclaration(services, expression);
        if (!calleeDeclaration) return;

        const jsDocThrowsTagTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
        if (!jsDocThrowsTagTypes.length) return;

        const maybeReject = jsDocThrowsTagTypes
          .some(type =>
            utils.isPromiseLike(services.program, type) &&
            type.symbol.getName() === 'Promise'
          );

        if (!maybeReject) return;

        if (isInAsyncHandledContext(sourceCode, expression)) return;

        context.report({
          node: expression,
          messageId: 'unhandledRejection',
        });
      },
    };
  },
});
