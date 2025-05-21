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
      /** @param {import('@typescript-eslint/utils').TSESTree.ExpressionStatement} node */
      'FunctionDeclaration :not(TryStatement > BlockStatement) ExpressionStatement:has(> CallExpression)'(node) {
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

        if (node.expression.type !== 'CallExpression') return;

        const calleeType = services.getTypeAtLocation(node.expression.callee);
        if (!calleeType.symbol) return;
        const calleeTags = calleeType.symbol.getJsDocTags();

        const isCalleeThrowable = calleeTags
          .some((tag) => tag.name === 'throws' || tag.name === 'exception');

        if (!isCalleeThrowable) return;

        const lines = sourceCode.getLines();
        const currentLine = lines[node.loc.start.line - 1];
        const indent = currentLine.match(/^\s*/)?.[0] ?? '';
        const newIndent = indent + ' '.repeat(tabLength);
        const prevLine = lines[node.loc.start.line - 2];

        // TODO: Better way to handle this?
        if (/^\s*try\s*\{/.test(prevLine)) return;

        context.report({
          node,
          messageId: 'implicitPropagation',
          fix(fixer) {
            const fixes = [];
            fixes.push(
              fixer.insertTextBefore(node, `try {\n${newIndent}`),
              fixer.insertTextAfter(node, `\n${indent}} catch {}`),
            );
            return fixes;
          },
        });
      },
    };
  },
  defaultOptions: [{ tabLength: 4 }],
});
