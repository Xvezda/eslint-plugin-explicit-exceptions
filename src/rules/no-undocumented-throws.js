// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const ts = require('typescript');
const {
  createRule,
  findParent,
  hasJSDocThrowsTag,
  typesToUnionString,
  isInHandledContext,
  getOptionsFromContext,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  isTypesAssignableTo,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  createInsertJSDocBeforeFixer,
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

      const throwStatementNodes = throwStatements.get(node.range[0]);
      if (!throwStatementNodes) return;

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

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) {
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

      const throwsTypeString = node.async
        ? `Promise<${typesToUnionString(checker, throwTypes)}>`
        : typesToUnionString(checker, throwTypes);


      context.report({
        node,
        messageId: 'missingThrowsTag',
        fix: createInsertJSDocBeforeFixer(
          sourceCode,
          nodeToComment,
          throwsTypeString
        ),
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

      /**
       * Visitor for checking `new Promise()` calls
       * @param {import('@typescript-eslint/utils').TSESTree.NewExpression} node
       */
      'NewExpression[callee.type="Identifier"][callee.name="Promise"]'(node) {
        const functionDeclaration = findClosestFunctionNode(node);
        if (!functionDeclaration) return;

        const nodeToComment = findNodeToComment(functionDeclaration);
        if (!nodeToComment) return;

        if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

        if (!node.arguments.length) return;

        /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
        let callbackNode = null;
        switch (node.arguments[0].type) {
          case AST_NODE_TYPES.ArrowFunctionExpression:
          case AST_NODE_TYPES.FunctionExpression:
            callbackNode = node.arguments[0];
            break;
          case AST_NODE_TYPES.Identifier: {
            const declaration =
              findIdentifierDeclaration(sourceCode, node.arguments[0]);

            if (!declaration) return;

            callbackNode =
              /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
              (declaration);
          }
          default:
            break;
        }
        if (!callbackNode || callbackNode.params.length < 2) return;

        const rejectCallbackNode = callbackNode.params[1];
        if (rejectCallbackNode.type !== AST_NODE_TYPES.Identifier) return;

        const callbackScope = sourceCode.getScope(callbackNode)
        if (!callbackScope) return;

        const rejectCallbackRefs = callbackScope.set.get(rejectCallbackNode.name)?.references;
        if (!rejectCallbackRefs) return;

        const callRefs = rejectCallbackRefs
          .filter(ref =>
            ref.identifier.parent.type === AST_NODE_TYPES.CallExpression)
          .map(ref =>
            /** @type {import('@typescript-eslint/utils').TSESTree.CallExpression} */
            (ref.identifier.parent)
          );

        if (!callRefs.length) return;

        const rejectTypes = callRefs
          .map(ref => services.getTypeAtLocation(ref.arguments[0]));

        if (!rejectTypes.length) return;

        const references = sourceCode.getScope(node).references;
        if (!references.length) return;

        const rejectHandled = references
          .some(ref =>
            findParent(ref.identifier, (node) =>
              node.type === AST_NODE_TYPES.MemberExpression &&
              node.property.type === AST_NODE_TYPES.Identifier &&
              node.property.name === 'catch'
            )
          );

        if (rejectHandled) return;

        context.report({
          node,
          messageId: 'missingThrowsTag',
          fix: createInsertJSDocBeforeFixer(
            sourceCode,
            nodeToComment,
            `Promise<${typesToUnionString(checker, rejectTypes)}>`
          )
        });
      },
    };
  },
});
