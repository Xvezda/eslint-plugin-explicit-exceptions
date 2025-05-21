// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
/** @type {import('@typescript-eslint/type-utils/dist')} */
// @ts-ignore
const utils = require('@typescript-eslint/type-utils');
const { hasThrowsTag, findParent } = require('../utils');
const ts = require('typescript');

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

    const options = Object.assign(Object.create(null), ...context.options);

    /** @type {Map<number, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>} */
    const throwStatements = new Map();

    /** @param {import('typescript').Type[]} types */
    const typesToUnionString = (types) =>
      types.map(t => utils.getTypeName(checker, t)).join('|');

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.ThrowStatement} node */
      'FunctionDeclaration :not(TryStatement > BlockStatement) ThrowStatement'(node) {
        const declaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) => n.type === 'FunctionDeclaration'));

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
          });

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
            return fixer
              .insertTextBefore(
                node,
                `/**\n` +
                ` * @throws {${typesToUnionString(throwTypes)}}\n` +
                ` */\n`
              );
          },
        });
        return;
      },
    };
  },
});
