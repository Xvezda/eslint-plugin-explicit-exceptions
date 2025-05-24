// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const {
  createRule,
  hasThrowsTag,
  findParent,
  getOptionsFromContext,
  getDeclarationTSNodeOfESTreeNode,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  isTypesAssignableTo,
} = require('../utils');

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
      throwTypeMismatch:
        'The type of the exception thrown does not match the type specified in the @throws (or @exception) tag.',
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
    const options = getOptionsFromContext(context);

    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.ExpressionStatement} node */
      'FunctionDeclaration :not(TryStatement > BlockStatement) ExpressionStatement:has(> CallExpression)'(node) {
        if (node.expression.type !== AST_NODE_TYPES.CallExpression) return;

        const callerDeclaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) => n.type === AST_NODE_TYPES.FunctionDeclaration));

        const comments = sourceCode.getCommentsBefore(callerDeclaration);
        const isCommented =
          comments.length &&
          comments
            .map(({ value }) => value)
            .some(hasThrowsTag);

        // TODO: Branching type checking or not
        if (isCommented) {
          const calleeDeclarationTSNode =
            getDeclarationTSNodeOfESTreeNode(services, node.expression.callee);

          if (!calleeDeclarationTSNode) return;

          const callerDeclarationTSNode =
            getDeclarationTSNodeOfESTreeNode(services, callerDeclaration);

          if (!callerDeclarationTSNode) return;

          const calleeThrowsTypes =
            toFlattenedTypeArray(
              getJSDocThrowsTagTypes(checker, calleeDeclarationTSNode)
            );

          const callerThrowsTags = getJSDocThrowsTags(callerDeclarationTSNode);
          const callerThrowsTypeNodes =
            callerThrowsTags
              .map(tag => tag.typeExpression?.type)
              .filter(tag => !!tag);

          const callerThrowsTypes = getJSDocThrowsTagTypes(checker, callerDeclarationTSNode);

          if (
            isTypesAssignableTo(checker, calleeThrowsTypes, callerThrowsTypes)
          ) {
            return;
          }

          context.report({
            node,
            messageId: 'throwTypeMismatch',
            fix(fixer) {
              const lastThrowsTypeNode =
                callerThrowsTypeNodes[callerThrowsTypeNodes.length - 1];

              if (callerThrowsTags.length > 1) {
                const lastThrowsTag = callerThrowsTags[callerThrowsTags.length - 1];
                const notAssignableThrows = calleeThrowsTypes
                  .filter((t) => !callerThrowsTypes
                    .some((n) => checker.isTypeAssignableTo(t, n)));

                const callerJSDocTSNode = lastThrowsTag.parent;
                /**
                 * @param {string} jsdocString
                 * @param {import('typescript').Type[]} types
                 * @returns {string}
                 */
                const appendThrowsTags = (jsdocString, types) =>
                  types.reduce((acc, t) =>
                    acc.replace(
                      /([^*\n]+)(\*+[/])/,
                      `$1* @throws {${utils.getTypeName(checker, t)}}\n$1$2`
                    ),
                    jsdocString
                  );

                return fixer.replaceTextRange(
                  [callerJSDocTSNode.getStart(), callerJSDocTSNode.getEnd()],
                  appendThrowsTags(
                    callerJSDocTSNode.getFullText(),
                    notAssignableThrows
                  )
                );
              }

              // If there is only one throws tag, make it as a union type
              return fixer.replaceTextRange(
                [lastThrowsTypeNode.pos, lastThrowsTypeNode.end],
                calleeThrowsTypes
                  .map(t => utils.getTypeName(checker, t)).join(' | '),
              );
            },
          });

          return;
        }

        const calleeType = services.getTypeAtLocation(node.expression.callee);
        if (!calleeType.symbol) return;

        const calleeTags = calleeType.symbol.getJsDocTags();

        const isCalleeThrowable = calleeTags
          .some((tag) => tag.name === 'throws' || tag.name === 'exception');

        if (!isCalleeThrowable) return;

        const lines = sourceCode.getLines();

        const currentLine = lines[node.loc.start.line - 1];
        const prevLine = lines[node.loc.start.line - 2];

        const indent = currentLine.match(/^\s*/)?.[0] ?? '';
        const newIndent = indent + ' '.repeat(options.tabLength);

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
