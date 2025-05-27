// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const {
  createRule,
  getCalleeDeclaration,
  isInAsyncHandledContext,
  isPromise,
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
    const visitExpression = (node) => {
      const calleeDeclaration = getCalleeDeclaration(services, node);
      if (!calleeDeclaration) return;

      const jsDocThrowsTagTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
      if (!jsDocThrowsTagTypes.length) return;

      const maybeReject = jsDocThrowsTagTypes
        .some(type => isPromise(services, type));

      if (!maybeReject) return;

      if (isInAsyncHandledContext(sourceCode, node)) return;

      context.report({
        node,
        messageId: 'unhandledRejection',
      });
    }; 

    return {
      CallExpression: visitExpression,
      MemberExpression: visitExpression,
    };
  },
});
