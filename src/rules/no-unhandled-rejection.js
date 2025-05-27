// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const {
  createRule,
  getCalleeDeclaration,
  isInAsyncHandledContext,
  getJSDocThrowsTagTypes,
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

    /** @param {import('@typescript-eslint/utils').TSESTree.Expression} node */
    const visit = (node) => {
      const calleeDeclaration = getCalleeDeclaration(services, node);
      if (!calleeDeclaration) return;

      const jsDocThrowsTagTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
      if (!jsDocThrowsTagTypes.length) return;

      const maybeReject = jsDocThrowsTagTypes
        .some(type =>
          utils.isPromiseLike(services.program, type) &&
          type.symbol.getName() === 'Promise'
        );

      if (!maybeReject) return;

      if (isInAsyncHandledContext(sourceCode, node)) return;

      context.report({
        node: node,
        messageId: 'unhandledRejection',
      });
    }; 

    return {
      CallExpression: visit,
      MemberExpression: visit,
    };
  },
});
