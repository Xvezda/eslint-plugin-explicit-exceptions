// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  getFirst,
  getNodeID,
  createRule,
  hasJSDocThrowsTag,
  typesToUnionString,
  isInHandledContext,
  isInAsyncHandledContext,
  getJSDocThrowsTagTypes,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  createInsertJSDocBeforeFixer,
  toFlattenedTypeArray,
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

    const {
      useBaseTypeOfLiteral = false,
    } = context.options[0] ?? {};

    /** @type {Set<string>} */
    const visitedFunctionNodes = new Set();

    /**
     * Group throw statements in functions
     * @type {Map<string, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatements = new Map();

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitOnExit = (node) => {
      if (visitedFunctionNodes.has(getNodeID(node))) return;
      visitedFunctionNodes.add(getNodeID(node));

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

      const throwStatementNodes = throwStatements.get(getNodeID(node));
      if (!throwStatementNodes) return;

      /** @type {import('typescript').Type[]} */
      const throwTypes =
        toFlattenedTypeArray(
          throwStatementNodes
            .map(n => {
              const type = services.getTypeAtLocation(n.argument);
              const tsNode = services.esTreeNodeToTSNodeMap.get(n.argument);

              if (
                useBaseTypeOfLiteral &&
                ts.isLiteralTypeLiteral(tsNode)
              ) {
                return checker.getBaseTypeOfLiteralType(type);
              }
              return type;
            })
        )
        .map(t => checker.getAwaitedType(t) ?? t);

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

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

        if (!throwStatements.has(getNodeID(functionDeclaration))) {
          throwStatements.set(getNodeID(functionDeclaration), []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatements.get(getNodeID(functionDeclaration)));

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
      'NewExpression[callee.type="Identifier"][callee.name="Promise"]:exit'(node) {
        const functionDeclaration = findClosestFunctionNode(node);
        if (!functionDeclaration) return;

        const calleeType = services.getTypeAtLocation(node.callee);
        if (!utils.isPromiseConstructorLike(services.program, calleeType)) {
          return;
        }
        
        if (!node.arguments.length) return;

        // `new Klass(firstArg ...)`
        //            ^ here
        const firstArg = getFirst(node.arguments);
        if (!firstArg) return;

        /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
        let callbackNode = null;
        switch (firstArg.type) {
          // Promise argument is inlined function
          case AST_NODE_TYPES.ArrowFunctionExpression:
          case AST_NODE_TYPES.FunctionExpression:
            callbackNode = firstArg;
            break;
          // Promise argument is not inlined function
          case AST_NODE_TYPES.Identifier: {
            const declaration =
              findIdentifierDeclaration(sourceCode, firstArg);

            if (!declaration) return;

            callbackNode =
              /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
              (declaration);
          }
          default:
            break;
        }
        if (!callbackNode) return;

        /**
         * Types which thrown or rejected and should be wrapped into `Promise<...>` later
         * @type {import('typescript').Type[]}
         */
        const rejectTypes = [];

        const isRejectCallbackNameDeclared =
          callbackNode.params.length >= 2;

        if (isRejectCallbackNameDeclared) {
          const rejectCallbackNode = callbackNode.params[1];
          if (rejectCallbackNode.type !== AST_NODE_TYPES.Identifier) return;

          const callbackScope = sourceCode.getScope(callbackNode)
          if (!callbackScope) return;

          const rejectCallbackRefs =
            callbackScope.set.get(rejectCallbackNode.name)?.references;

          if (!rejectCallbackRefs) return;

          const callRefs = rejectCallbackRefs
            .filter(ref =>
              ref.identifier.parent.type === AST_NODE_TYPES.CallExpression)
            .map(ref =>
              /** @type {import('@typescript-eslint/utils').TSESTree.CallExpression} */
              (ref.identifier.parent)
            );

          const argumentTypes = callRefs
            .map(ref => services.getTypeAtLocation(ref.arguments[0]));

          rejectTypes.push(...toFlattenedTypeArray(argumentTypes));
        }

        if (throwStatements.has(getNodeID(callbackNode))) {
          const throwStatementTypes = throwStatements
            .get(getNodeID(callbackNode))
            ?.map(n => services.getTypeAtLocation(n.argument));

          if (throwStatementTypes) {
            rejectTypes.push(...toFlattenedTypeArray(throwStatementTypes));
          }
        }

        const callbackThrowsTagTypes = getJSDocThrowsTagTypes(
          checker,
          services.esTreeNodeToTSNodeMap.get(callbackNode)
        );

        if (callbackThrowsTagTypes.length) {
          rejectTypes.push(...callbackThrowsTagTypes);
        }

        if (!rejectTypes.length) return;

        if (isInAsyncHandledContext(sourceCode, node)) return;

        const nodeToComment = findNodeToComment(functionDeclaration);
        if (!nodeToComment) return;

        if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

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
