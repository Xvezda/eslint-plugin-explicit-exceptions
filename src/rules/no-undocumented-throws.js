// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  createRule,
  hasThrowsTag,
  findParent,
  getOptionsFromContext
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

    /** @type {Map<number, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>} */
    const throwStatements = new Map();

    /** @param {import('typescript').Type[]} types */
    const typesToUnionString = (types) =>
      types.map(t => utils.getTypeName(checker, t)).join(' | ');

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.ThrowStatement} node */
      'FunctionDeclaration :not(TryStatement > BlockStatement) ThrowStatement'(node) {
        const declaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) => n.type === AST_NODE_TYPES.FunctionDeclaration));

        if (!throwStatements.has(declaration.range[0])) {
          throwStatements.set(declaration.range[0], []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatements.get(declaration.range[0]));

        throwStatementNodes.push(node);
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
          const tags =
            /** @type {import('typescript').JSDocThrowsTag[]} */
            (ts.getAllJSDocTagsOfKind(
              services.esTreeNodeToTSNodeMap.get(node),
              ts.SyntaxKind.JSDocThrowsTag
            ));

          const tagTypeNodes = tags
            .map(tag => tag.typeExpression?.type)
            .filter(tag => !!tag);

          if (!tagTypeNodes.length) return;

          const isAllThrowsAssignable = throwTypes
            .every(t => tagTypeNodes
              .some(n => checker
                .isTypeAssignableTo(t, checker.getTypeFromTypeNode(n))));

          if (isAllThrowsAssignable) return;

          const lastTagtypeNode = tagTypeNodes[tagTypeNodes.length - 1];

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
