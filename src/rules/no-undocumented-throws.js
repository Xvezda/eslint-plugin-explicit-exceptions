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

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.ThrowStatement} node */
      ':not(TryStatement > BlockStatement) ThrowStatement'(node) {
        const functionDeclaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) =>
            n.type === AST_NODE_TYPES.FunctionDeclaration ||
            n.type === AST_NODE_TYPES.FunctionExpression ||
            n.type === AST_NODE_TYPES.ArrowFunctionExpression
          ));

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
      /** @param {import('@typescript-eslint/utils').TSESTree.ArrowFunctionExpression} node */
      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > ArrowFunctionExpression:has(:not(TryStatement > BlockStatement) ThrowStatement):exit'(node) {
        const variableDeclaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.VariableDeclaration} */
          (findParent(node, (n) => n.type === AST_NODE_TYPES.VariableDeclaration));

        if (!variableDeclaration) return;

        const throwStatementNodes = throwStatements.get(node.range[0]);

        if (!throwStatementNodes) return;

        const comments = sourceCode.getCommentsBefore(variableDeclaration);

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
          if (!services.esTreeNodeToTSNodeMap.has(variableDeclaration)) return;

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
            const currentLine = lines[variableDeclaration.loc.start.line - 1];
            const indent = currentLine.match(/^\s*/)?.[0] ?? '';
            return fixer
              .insertTextBefore(
                variableDeclaration,
                `/**\n` +
                `${indent} * @throws {${typesToUnionString(throwTypes)}}\n` +
                `${indent} */\n` +
                `${indent}`
              );
          },
        });
        return;
      },
      /** @param {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} node */
      'FunctionDeclaration:has(:not(TryStatement > BlockStatement) ThrowStatement):exit'(node) {
        const throwStatementNodes = throwStatements.get(node.range[0]);

        if (!throwStatementNodes) return;

        const comments = sourceCode.getCommentsBefore(node);

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
          if (!services.esTreeNodeToTSNodeMap.has(node)) return;

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
            const currentLine = lines[node.loc.start.line - 1];
            const indent = currentLine.match(/^\s*/)?.[0] ?? '';
            return fixer
              .insertTextBefore(
                node,
                `/**\n` +
                `${indent} * @throws {${typesToUnionString(throwTypes)}}\n` +
                `${indent} */\n` +
                `${indent}`
              );
          },
        });
        return;
      },
    };
  },
});
