// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const {
  createRule,
  getCalleeDeclarations,
  isInAsyncHandledContext,
  isPromiseType,
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
      const calleeDeclarations = getCalleeDeclarations(services, node);
      if (!calleeDeclarations.length) return;

      const isRejectable = calleeDeclarations
        .some((calleeDeclaration) => {
          const jsDocThrowsTagTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
          if (!jsDocThrowsTagTypes.length) return false;

          const maybeReject = jsDocThrowsTagTypes
            .some(type => isPromiseType(services, type));

          if (!maybeReject) return false;

          if (isInAsyncHandledContext(sourceCode, node)) return false;

          return true;
        });

      if (!isRejectable) return;

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
