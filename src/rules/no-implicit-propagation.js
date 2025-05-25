// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const {
  createRule,
  isInHandledContext,
  typesToUnionString,
  hasThrowsTag,
  hasJSDocThrowsTag,
  getCalleeDeclaration,
  getDeclarationTSNodeOfESTreeNode,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  isTypesAssignableTo,
  findClosestFunctionNode,
  findNodeToComment,
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
        'Implicit propagation of exceptions is not allowed. Add JSDoc comment with @throws (or @exception) tag.',
      throwTypeMismatch:
        'The type of the exception thrown does not match the type specified in the @throws (or @exception) tag.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    const visitedNodes = new Set();

    /** @param {import('@typescript-eslint/utils').TSESTree.ExpressionStatement} node */
    const visitExpression = (node) => {
      if (visitedNodes.has(node.range[0])) return;
      visitedNodes.add(node.range[0]);

      if (isInHandledContext(node)) return;

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const nodeToComment = findNodeToComment(callerDeclaration);
      if (!nodeToComment) return;

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) {
        const calleeDeclaration = getCalleeDeclaration(services, node);
        if (!calleeDeclaration) return;

        const calleeThrowsTypes = toFlattenedTypeArray(getJSDocThrowsTagTypes(checker, calleeDeclaration));
        if (!calleeThrowsTypes.length) return;

        const callerDeclarationTSNode =
          getDeclarationTSNodeOfESTreeNode(services, callerDeclaration);

        if (!callerDeclarationTSNode) return;

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

      const calleeDeclaration = getCalleeDeclaration(services, node);
      if (!calleeDeclaration) return;

      const calleeTags = getJSDocThrowsTags(calleeDeclaration);

      const isCalleeThrows = calleeTags.length > 0;
      if (!isCalleeThrows) return;
      
      const calleeThrowsTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);

      context.report({
        node,
        messageId: 'implicitPropagation',
        fix(fixer) {
          const lines = sourceCode.getLines();
          const currentLine = lines[nodeToComment.loc.start.line - 1];
          const indent = currentLine.match(/^\s*/)?.[0] ?? '';
          return fixer
            .insertTextBefore(
              nodeToComment,
              `/**\n` +
              `${indent} * @throws {${typesToUnionString(checker, calleeThrowsTypes)}}\n` +
              `${indent} */\n` +
              `${indent}`
            );
        },
      });
    };

    return {
      'ArrowFunctionExpression ExpressionStatement MemberExpression[property.type="Identifier"]': visitExpression,
      'FunctionDeclaration ExpressionStatement MemberExpression[property.type="Identifier"]': visitExpression,
      'FunctionExpression ExpressionStatement MemberExpression[property.type="Identifier"]': visitExpression,
      'ArrowFunctionExpression ExpressionStatement CallExpression[callee.type="Identifier"]': visitExpression,
      'FunctionDeclaration ExpressionStatement CallExpression[callee.type="Identifier"]': visitExpression,
      'FunctionExpression ExpressionStatement CallExpression[callee.type="Identifier"]': visitExpression,
      'ArrowFunctionExpression ExpressionStatement AssignmentExpression[left.type="MemberExpression"]': visitExpression,
      'FunctionDeclaration ExpressionStatement AssignmentExpression[left.type="MemberExpression"]': visitExpression,
      'FunctionExpression ExpressionStatement AssignmentExpression[left.type="MemberExpression"]': visitExpression,
    };
  },
  defaultOptions: [],
});
