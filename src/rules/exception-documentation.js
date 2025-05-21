// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
/** @type {import('@typescript-eslint/type-utils/dist')} */
// @ts-ignore
const utils = require('@typescript-eslint/type-utils');
/** @type {import('@typescript-eslint/parser/dist')} */
// @ts-ignore
const parser = require('@typescript-eslint/parser');  
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
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    return {
      /** @param {import('@typescript-eslint/utils').TSESTree.ThrowStatement} node */
      'FunctionDeclaration:not(:has(TryStatement)) ThrowStatement'(node) {
        const declaration =
          /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
          (findParent(node, (n) => n.type === 'FunctionDeclaration'));

        const comments = sourceCode.getCommentsBefore(declaration);

        const isCommented = 
          comments.length &&
          comments
            .map(({ value }) => value)
            .some(hasThrowsTag);

        const throwType = services.getTypeAtLocation(node.argument);

        if (isCommented) {
          const tags =
            /** @type {import('typescript').JSDocThrowsTag[]} */
            (ts.getAllJSDocTagsOfKind(
              services.esTreeNodeToTSNodeMap.get(declaration),
              ts.SyntaxKind.JSDocThrowsTag
            ));

          console.log(tags);

          const tagTypeNodes = tags
            .map(tag => tag.typeExpression?.type)

          const tagTypes = tagTypeNodes
            .filter(tag => !!tag)
            .map(tag => checker.getTypeFromTypeNode(tag));

          if (tagTypes.some(t => checker.isTypeAssignableTo(throwType, t))) {
            return;
          }

          context.report({
            node: declaration,
            messageId: 'throwTypeMismatch',
            data: {
              type: utils.getTypeName(checker, throwType),
            },
            fix(fixer) {
              const notAssignableTags = tagTypeNodes
                .filter(t => !!t)
                .filter(t =>
                  !checker
                    .isTypeAssignableTo(
                      throwType, checker.getTypeFromTypeNode(t)
                    )
                );

              const fixes = [];

              if (notAssignableTags.length > 0) {
                const [firstNotAssignableTag] = notAssignableTags;
                fixes.push(
                  fixer.replaceTextRange(
                    [firstNotAssignableTag.pos, firstNotAssignableTag.end],
                    utils.getTypeName(checker, throwType)
                  )
                );
              } else {
                fixes.push(fixer
                  .insertTextBefore(
                    declaration,
                    `/**\n` +
                    ` * @throws {${utils.getTypeName(checker, throwType)}}\n` +
                    ` */\n`
                  ));
              }
              return fixes;
            },
          });
          return;
        }

        if (!isCommented) {
          context.report({
            node: declaration,
            messageId: 'missingThrowsTag',
            fix(fixer) {
              return fixer
                .insertTextBefore(
                  declaration,
                  `/**\n` +
                  ` * @throws {${utils.getTypeName(checker, throwType)}}\n` +
                  ` */\n`
                );
            },
          });
          return;
        }
      },
    };
  },
  defaultOptions: [],
});
