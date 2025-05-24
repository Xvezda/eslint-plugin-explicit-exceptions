// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  createRule,
  hasThrowsTag,
  findParent,
  getOptionsFromContext,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  isTypesAssignableTo,
} = require('../utils');

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findParentFunctionNode = (node) => {
  return findParent(node, (n) =>
    n.type === AST_NODE_TYPES.FunctionDeclaration ||
    n.type === AST_NODE_TYPES.FunctionExpression ||
    n.type === AST_NODE_TYPES.ArrowFunctionExpression
  );
};

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findNodeToComment = (node) => {
  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      return node;
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression:
      return (
        /**
         * @example
         * ```
         * class Klass {
         *   // here
         *   target() { ... }
         * }
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.MethodDefinition) ??
        /**
         * @example
         * ```
         * const obj = {
         *   // here
         *   target: () => { ... },
         * };
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.Property) ??
        /**
         * @example
         * ```
         * // here
         * const target = () => { ... };
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.VariableDeclaration)
      );
    default:
      break;
  }
  return null;
};

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

    /**
     * Group throw statements in functions
     * @type {Map<number, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatements = new Map();

    /** @param {import('typescript').Type[]} types */
    const typesToUnionString = (types) =>
      types.map(t => utils.getTypeName(checker, t)).join(' | ');

    /** @param {import('@typescript-eslint/utils').TSESTree.Node} node */
    const visitOnExit = (node) => {
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

        const throwsTagTypes = getJSDocThrowsTagTypes(checker, functionDeclarationTSNode);

        if (isTypesAssignableTo(checker, throwTypes, throwsTagTypes)) return;

        const lastTagtypeNode = throwsTagTypeNodes[throwsTagTypeNodes.length - 1];

        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [lastTagtypeNode.pos, lastTagtypeNode.end],
              typesToUnionString(throwTypes)
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
          return fixer
            .insertTextBefore(
              nodeToComment,
              `/**\n` +
              `${indent} * @throws {${typesToUnionString(throwTypes)}}\n` +
              `${indent} */\n` +
              `${indent}`
            );
        },
      });
      return;
    };

    const createExpressionVisitors = () => {
      return ['ArrowFunctionExpression', 'FunctionExpression'].reduce((acc, type) => {
        return {
          ...acc,
          [`VariableDeclaration > VariableDeclarator[id.type="Identifier"] > ${type}:has(:not(TryStatement > BlockStatement) ThrowStatement):exit`]: visitOnExit,
          [`Property > ${type}:has(:not(TryStatement > BlockStatement) ThrowStatement):exit`]: visitOnExit,
          [`MethodDefinition > ${type}:has(:not(TryStatement > BlockStatement) ThrowStatement):exit`]: visitOnExit,
        };
      }, {});
    };

    return {
      /**
       * Collect and group throw statements in functions
       *
       * @param {import('@typescript-eslint/utils').TSESTree.ThrowStatement} node
       */
      ':not(TryStatement > BlockStatement) ThrowStatement'(node) {
        const functionDeclaration = findParentFunctionNode(node);

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

      'FunctionDeclaration:has(:not(TryStatement > BlockStatement) ThrowStatement):exit': visitOnExit,

      ...createExpressionVisitors(),
    };
  },
});
