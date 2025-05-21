// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const { hasThrowsTag } = require('../utils');
const { findParent } = require('../utils');

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-exception-documentation/blob/main/docs/rules/${name}.md`,
);

module.exports = createRule({
  name: 'no-implicit-propagation',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not allows implicit propagation of exceptions',
    },
    fixable: 'code',
    messages: {
      implicitPropagation:
        'Implicit propagation of exceptions is not allowed. Use try/catch to handle exceptions.',
    },
    defaultOptions: [
      { tabLength: 4 },
    ],
    schema: [
      {
        type: 'object',
        properties: {
          tabLength: {
            type: 'number',
            default: 4,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const [{ tabLength }] = context.options;

    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node */
      'FunctionDeclaration:not(:has(TryStatement)) CallExpression'(node) {
        const declaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) => n.type === 'FunctionDeclaration'));

        const comments = sourceCode.getCommentsBefore(declaration);
        const isCommented =
          comments.length &&
          comments
            .map(({ value }) => value)
            .some(hasThrowsTag);

        if (isCommented) return;

        const calleeType = services.getTypeAtLocation(node.callee);
        const calleeTags = calleeType.symbol.getJsDocTags();

        const isCalleeThrowable = calleeTags
          .some((tag) => tag.name === 'throws' || tag.name === 'exception');

        if (isCalleeThrowable) {
          context.report({
            node: node.parent,
            messageId: 'implicitPropagation',
            fix(fixer) {
              const indent = ' '.repeat(node.loc.start.column);

              const fixes = [];

              fixes.push(fixer.insertTextBefore(node.parent, 'try {\n'));
              fixes.push(
                fixer.insertTextAfter(
                  node.parent,
                  `${indent + ' '.repeat(tabLength)}` +
                  `${sourceCode.getText(node.parent)}\n` +
                  `${indent}` +
                  `} catch {}`
                )
              );
              fixes.push(fixer.remove(node.parent));
              return fixes;
            },
          });
        }
      },
    };
  },
  defaultOptions: [{ tabLength: 4 }],
});
