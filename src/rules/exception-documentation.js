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

    const options = Object.assign({}, ...context.options);

    /** @type {Map<`${number}:${number}`, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>} */
    const throwStatements = new Map();

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.ThrowStatement} node */
      'FunctionDeclaration:not(:has(TryStatement)) ThrowStatement'(node) {
        const declaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) => n.type === 'FunctionDeclaration'));

        /** @type {`${number}:${number}`} */
        const key = `${declaration.range[0]}:${declaration.range[1]}`;
        if (!throwStatements.has(key)) {
          throwStatements.set(key, []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatements.get(key));

        throwStatementNodes.push(node);
      },
      /** @param {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} node */
      'FunctionDeclaration:not(:has(TryStatement)):has(ThrowStatement):exit'(node) {
        const throwStatementNodes = throwStatements
          .get(`${node.range[0]}:${node.range[1]}`);

        if (!throwStatementNodes) return;

        const comments = sourceCode.getCommentsBefore(node);

        const isCommented = 
          comments.length &&
          comments
            .map(({ value }) => value)
            .some(hasThrowsTag);

        /** @type {import('typescript').Type[]} */
        const throwTypes = throwStatementNodes
          .map(n =>
            options.useBaseTypeOfLiteral && ts.isLiteralTypeLiteral(services.esTreeNodeToTSNodeMap.get(n.argument))
              ? checker.getBaseTypeOfLiteralType(services.getTypeAtLocation(n.argument))
              : services.getTypeAtLocation(n.argument)
          );

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
                throwTypes.map(t => utils.getTypeName(checker, t)).join('|')
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
                ` * @throws {${throwTypes.map(t => utils.getTypeName(checker, t)).join('|')}}\n` +
                ` */\n`
              );
          },
        });
        return;
      },
    };
  },
});
