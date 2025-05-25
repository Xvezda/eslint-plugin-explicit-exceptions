// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  createRule,
  hasThrowsTag,
  typesToUnionString,
  isInHandledContext,
  getOptionsFromContext,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  isTypesAssignableTo,
  findClosestFunctionNode,
  findNodeToComment,
} = require('../utils');


module.exports = createRule({
  name: 'no-undocumented-throws',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Explicitly document exceptions thrown by functions',
    },
    fixable: 'code',
    messages: {
      missingThrowsTag: 'Missing @throws (or @exception) tag in JSDoc comment.',
      throwTypeMismatch:
        'The type of the exception thrown does not match the type specified in the @throws (or @exception) tag.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          useBaseTypeOfLiteral: {
            type: 'boolean',
            default: false,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    { useBaseTypeOfLiteral: false },
  ],
  create(context) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    
    const options = getOptionsFromContext(context);

    const visitedNodes = new Set();

    /**
     * Group throw statements in functions
     * @type {Map<number, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatements = new Map();

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitOnExit = (node) => {
      if (visitedNodes.has(node.range[0])) return;
      visitedNodes.add(node.range[0]);

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

      const comments = sourceCode.getCommentsBefore(nodeToComment);

      const throwStatementNodes = throwStatements.get(node.range[0]);
      if (!throwStatementNodes) return;

      const isCommented = 
        comments.length &&
        comments
          .map(({ value }) => value)
          .some(hasThrowsTag);

      /** @type {import('typescript').Type[]} */
      const throwTypes = throwStatementNodes
        .map(n => {
          const type = services.getTypeAtLocation(n.argument);
          const tsNode = services.esTreeNodeToTSNodeMap.get(n.argument);

          return options.useBaseTypeOfLiteral && ts.isLiteralTypeLiteral(tsNode)
            ? checker.getBaseTypeOfLiteralType(type)
            : type;
        })
        .flatMap(t => t.isUnion() ? t.types : t);

      if (isCommented) {
        if (!services.esTreeNodeToTSNodeMap.has(nodeToComment)) return;

        const functionDeclarationTSNode = services.esTreeNodeToTSNodeMap.get(node);

        const throwsTags = getJSDocThrowsTags(functionDeclarationTSNode);
        const throwsTagTypeNodes = throwsTags
          .map(tag => tag.typeExpression?.type)
          .filter(tag => !!tag);

        if (!throwsTagTypeNodes.length) return;

        const throwsTagTypes = getJSDocThrowsTagTypes(checker, functionDeclarationTSNode)
          .map(t => node.async ? checker.getAwaitedType(t) : t)
          .filter(t => !!t);

        if (isTypesAssignableTo(checker, throwTypes, throwsTagTypes)) return;

        const lastTagtypeNode = throwsTagTypeNodes[throwsTagTypeNodes.length - 1];

        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [lastTagtypeNode.pos, lastTagtypeNode.end],
              typesToUnionString(checker, throwTypes)
            );
          },
        });
        return;
      }
      context.report({
        node,
        messageId: 'missingThrowsTag',
        fix(fixer) {
          const lines = sourceCode.getLines();
          const currentLine = lines[nodeToComment.loc.start.line - 1];
          const indent = currentLine.match(/^\s*/)?.[0] ?? '';

          const throwsTypeString = node.async
            ? `Promise<${typesToUnionString(checker, throwTypes)}>`
            : typesToUnionString(checker, throwTypes);

          return fixer
            .insertTextBefore(
              nodeToComment,
              `/**\n` +
              `${indent} * @throws {${throwsTypeString}}\n` +
              `${indent} */\n` +
              `${indent}`
            );
        },
      });
    };

    return {
      /**
       * Collect and group throw statements in functions
       */
      ThrowStatement(node) {
        if (isInHandledContext(node)) return; 

        const functionDeclaration = findClosestFunctionNode(node);
        if (!functionDeclaration) return;

        // TODO: Use "SAFE" unique function identifier
        if (!throwStatements.has(functionDeclaration.range[0])) {
          throwStatements.set(functionDeclaration.range[0], []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatements.get(functionDeclaration.range[0]));

        throwStatementNodes.push(node);
      },

      'FunctionDeclaration:exit': visitOnExit,
      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > ArrowFunctionExpression:exit': visitOnExit,
      'Property > ArrowFunctionExpression:exit': visitOnExit,
      'PropertyDefinition > ArrowFunctionExpression:exit': visitOnExit,
      'ReturnStatement > ArrowFunctionExpression:exit': visitOnExit,

      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > FunctionExpression:exit': visitOnExit,
      'Property > FunctionExpression:exit': visitOnExit,
      'PropertyDefinition > FunctionExpression:exit': visitOnExit,
      'MethodDefinition > FunctionExpression:exit': visitOnExit,
      'ReturnStatement > FunctionExpression:exit': visitOnExit,
    };
  },
});
