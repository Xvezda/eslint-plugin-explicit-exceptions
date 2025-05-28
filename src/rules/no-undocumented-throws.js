// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  getNodeID,
  createRule,
  hasJSDocThrowsTag,
  typesToUnionString,
  isInHandledContext,
  isInAsyncHandledContext,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
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
    const visitFunctionOnExit = (node) => {
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

    /**
     * @typedef {import('@typescript-eslint/utils').TSESTree.FunctionLike | import('@typescript-eslint/utils').TSESTree.Identifier} PromiseCallbackType
     * @param {PromiseCallbackType} node
     */
    const visitPromiseCallbackOnExit = (node) => {
      const functionDeclaration = findClosestFunctionNode(node.parent);
      if (!functionDeclaration) return;

      const isPromiseConstructorCallback =
        isPromiseConstructorCallbackNode(node) &&
        utils.isPromiseConstructorLike(
          services.program,
          services.getTypeAtLocation(
            /** @type {import('@typescript-eslint/utils').TSESTree.NewExpression} */
            (node.parent).callee
          )
        );

      const isThenableCallback =
        isThenableCallbackNode(node) &&
        node.parent.type === AST_NODE_TYPES.CallExpression &&
        utils.isPromiseLike(
          services.program,
          services.getTypeAtLocation(
            /** @type {import('@typescript-eslint/utils').TSESTree.MemberExpression} */
            (node.parent.callee).object
          )
        );

      if (!isPromiseConstructorCallback && !isThenableCallback) return;

      /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
      let callbackNode = null;
      switch (node.type) {
          // Promise argument is inlined function
        case AST_NODE_TYPES.ArrowFunctionExpression:
        case AST_NODE_TYPES.FunctionExpression:
          callbackNode = node;
          break;
          // Promise argument is not inlined function
        case AST_NODE_TYPES.Identifier: {
          const declaration =
            findIdentifierDeclaration(sourceCode, node);

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

      if (isPromiseConstructorCallback) {
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

      if (isInAsyncHandledContext(sourceCode, node.parent)) return;

      const nodeToComment = findNodeToComment(functionDeclaration);
      if (!nodeToComment) return;

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      context.report({
        node: node.parent,
        messageId: 'missingThrowsTag',
        fix: createInsertJSDocBeforeFixer(
          sourceCode,
          nodeToComment,
          `Promise<${typesToUnionString(checker, rejectTypes)}>`
        )
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
      'FunctionDeclaration:exit': visitFunctionOnExit,
      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > ArrowFunctionExpression:exit':
        visitFunctionOnExit,
      'Property > ArrowFunctionExpression:exit': visitFunctionOnExit,
      'PropertyDefinition > ArrowFunctionExpression:exit': visitFunctionOnExit,
      'ReturnStatement > ArrowFunctionExpression:exit': visitFunctionOnExit,

      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > FunctionExpression:exit':
        visitFunctionOnExit,
      'Property > FunctionExpression:exit': visitFunctionOnExit,
      'PropertyDefinition > FunctionExpression:exit': visitFunctionOnExit,
      'MethodDefinition > FunctionExpression:exit': visitFunctionOnExit,
      'ReturnStatement > FunctionExpression:exit': visitFunctionOnExit,

      /**
       * ```
       * new Promise(...)
       * //          ^ here
       * ```
       */
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > ArrowFunctionExpression:first-child:exit':
        visitPromiseCallbackOnExit,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > FunctionExpression:first-child:exit':
        visitPromiseCallbackOnExit,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > Identifier:first-child:exit':
        visitPromiseCallbackOnExit,
      /**
       * ```
       * new Promise(...).then(...)
       * //                    ^ here
       * new Promise(...).finally(...)
       * //                       ^ or here
       * ```
       */
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > ArrowFunctionExpression:first-child:exit':
        visitPromiseCallbackOnExit,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > FunctionExpression:first-child:exit':
        visitPromiseCallbackOnExit,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > Identifier:first-child:exit':
        visitPromiseCallbackOnExit,
    };
  },
});
