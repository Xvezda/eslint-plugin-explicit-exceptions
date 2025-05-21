// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const { hasThrowsTag } = require('../utils');

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
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * @param {import('@typescript-eslint/utils').TSESTree.Node} node
     * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} callback
     * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
     */
    const findParent = (node, callback) => {
      do {
        if (!node.parent) return null;

        node = node.parent;

        if (callback(node)) {
          return node;
        }
      } while (node);

      return null;
    };

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

        const services = ESLintUtils.getParserServices(context);

        const calleeType = services.getTypeAtLocation(node.callee);
        const calleeTags = calleeType.symbol.getJsDocTags();

        if (
          calleeTags.some((tag) =>
            tag.name === 'throws' || tag.name === 'exception'
          )
        ) {
          context.report({
            node,
            messageId: 'implicitPropagation',
            fix(fixer) {
              // TODO: Apply proper indentation?
              return fixer.replaceText(
                node.parent,
                `try { ${sourceCode.getText(node.parent)} } catch {}`,
              );
            },
          });
        }
      },
    };
  },
  defaultOptions: [],
});
