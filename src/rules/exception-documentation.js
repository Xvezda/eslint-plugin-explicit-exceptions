// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const { hasThrowsTag } = require('../utils');

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-exception-documentation/blob/main/docs/rules/${name}.md`,
);

module.exports = createRule({
  name: 'exception-documentation',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Explicitly document exceptions thrown by functions',
    },
    fixable: 'code',
    messages: {
      missingThrowsTag: 'Missing @throws (or @exception) tag in JSDoc comment.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} node */
      'FunctionDeclaration:has(ThrowStatement):not(:has(TryStatement))'(node) {
        const comments = sourceCode.getCommentsBefore(node);

        const isCommented = 
          comments.length &&
          comments
            .map(({ value }) => value)
            .some(hasThrowsTag);

        if (!isCommented) {
          context.report({
            node,
            messageId: 'missingThrowsTag',
            fix(fixer) {
              return fixer
                .insertTextBefore(
                  node,
                  // TODO: Grab exact type of thrown exception
                  '/**\n * @throws {Error}\n */\n'
                );
            },
          });
        }
      },
    };
  },
  defaultOptions: [],
});
