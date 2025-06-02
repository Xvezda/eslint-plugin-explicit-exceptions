// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  TypeMap,
  getNodeID,
  getNodeIndent,
  getFirst,
  createRule,
  hasJSDocThrowsTag,
  typesToUnionString,
  typeStringsToUnionString,
  isInHandledContext,
  isInAsyncHandledContext,
  isPromiseType,
  isNodeReturned,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
  isAccessorNode,
  getCalleeDeclarations,
  getJSDocThrowsTagTypes,
  findParent,
  findClosest,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  toFlattenedTypeArray,
  findFunctionCallNodes,
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
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;

    const {
      useBaseTypeOfLiteral = false,
    } = context.options[0] ?? {};

    /** @type {Set<string>} */
    const visitedFunctionNodes = new Set();

    /**
     * Group throw statements in functions
     * Using function as a key
     * @type {Map<string, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatementsInFunction = new Map();

    /**
     * Group of throwable types in functions
     */
    const throwTypes = new TypeMap();

    /**
     * Group of promise rejectable types in functions
     * Since `Promise<Error>` is own convention of this project,
     * these types should be wrapped into `Promise<...>` later
     */
    const rejectTypes = new TypeMap();

    /**
     * Visit function call node and collect types.
     * Since JavaScript has implicit function call via getters and setters,
     * this function handles those cases too.
     *
     * @param {import('@typescript-eslint/utils').TSESTree.Expression} node
     */
    const visitFunctionCallNode = (node) => {
      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const calleeDeclarations = getCalleeDeclarations(services, node);
      if (!calleeDeclarations.length) return;

      for (const calleeDeclaration of calleeDeclarations) {
        const calleeThrowsTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
        if (!calleeThrowsTypes.length) continue;

        for (const type of calleeThrowsTypes) {
          if (isPromiseType(services, type)) {
            if (isInAsyncHandledContext(sourceCode, node)) continue;
            rejectTypes.add(callerDeclaration, [type]);
          } else {
            if (isInHandledContext(node)) continue;
            throwTypes.add(callerDeclaration, [type]);
          }
        };
      }
    };

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitFunctionOnExit = (node) => {
      if (visitedFunctionNodes.has(getNodeID(node))) return;
      visitedFunctionNodes.add(getNodeID(node));

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

      const throwStatementNodes =
        throwStatementsInFunction.get(getNodeID(node));

      if (throwStatementNodes) {
        const throwStatementTypes =
          throwStatementNodes
            .map(n => {
              const type = services.getTypeAtLocation(n.argument);

              if (
                useBaseTypeOfLiteral &&
                ts.isLiteralTypeLiteral(
                  services.esTreeNodeToTSNodeMap.get(n.argument)
                )
              ) {
                return checker.getBaseTypeOfLiteralType(type);
              }
              return type;
            });

        const flattenedTypes = toFlattenedTypeArray(throwStatementTypes);

        const awaitedTypes = flattenedTypes
          .map(t => checker.getAwaitedType(t) ?? t);

        throwTypes.add(node, awaitedTypes);
      }

      const throwableTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
          throwTypes.get(node)
            ?.map(t => checker.getAwaitedType(t) ?? t)
          )
        );

      const rejectableTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
          rejectTypes.get(node)
            ?.map(t => checker.getAwaitedType(t) ?? t)
          )
        );

      if (
        !throwableTypes.length &&
        !rejectableTypes.length
      ) return;

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      context.report({
        node: nodeToComment,
        messageId: 'missingThrowsTag',
        fix(fixer) {
          const indent = getNodeIndent(sourceCode, node);

          const newType = 
            node.async
              ? `Promise<${typesToUnionString(checker, [
                ...throwableTypes,
                ...rejectableTypes,
              ])}>`
              : typeStringsToUnionString([
                ...throwableTypes.length
                  ? [typesToUnionString(checker, throwableTypes)]
                  : [],
                ...rejectableTypes.length
                  ? [`Promise<${typesToUnionString(checker, rejectableTypes)}>`]
                  : [],
              ]);

          return fixer
            .insertTextBefore(
              nodeToComment,
              `/**\n` +
              `${indent} * @throws {${newType}}\n` +
              `${indent} */\n` +
              `${indent}`
            );
        }
      });
    };

    /**
     * @typedef {import('@typescript-eslint/utils').TSESTree.FunctionLike | import('@typescript-eslint/utils').TSESTree.Identifier | import('@typescript-eslint/utils').TSESTree.MemberExpression} PromiseCallbackType
     * @param {PromiseCallbackType} node
     */
    const visitPromiseCallbackOnExit = (node) => {
      if (isInAsyncHandledContext(sourceCode, node.parent)) return;

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

      if (
        !isPromiseConstructorCallback &&
        !isThenableCallback
      ) return;

      const isPromiseReturned =
        // Return immediately
        (isPromiseConstructorCallback &&
          node.parent.type === AST_NODE_TYPES.NewExpression &&
          isNodeReturned(node.parent)
        ) ||
        (isThenableCallback && findParent(node, n =>
          n.type === AST_NODE_TYPES.CallExpression &&
          isNodeReturned(n)
        )) ||
        // Promise is assigned and returned
        sourceCode.getScope(node.parent)
          ?.references
          .map(ref => ref.identifier)
          .some(n => findClosest(n, isNodeReturned));

      if (!isPromiseReturned) return;

      /**
       * Find function where promise is actually returned.
       */ 
      let promiseReturningFunction = findClosestFunctionNode(node.parent);
      while (
        promiseReturningFunction &&
        (isPromiseConstructorCallbackNode(promiseReturningFunction) ||
          isThenableCallbackNode(promiseReturningFunction))
      ) {
        promiseReturningFunction =
          findClosestFunctionNode(promiseReturningFunction.parent);
      }
      if (!promiseReturningFunction) return;

      /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
      let callbackNode = null;
      switch (node.type) {
        // Promise argument is inlined function
        case AST_NODE_TYPES.ArrowFunctionExpression:
        case AST_NODE_TYPES.FunctionExpression:
          callbackNode = node;
          break;
        // Promise argument is not inlined function
        case AST_NODE_TYPES.MemberExpression: {
          // Use type information to find function declaration
          const propertySymbol = services.getSymbolAtLocation(node.property);
          const declarationNode = getFirst(
            propertySymbol
              ?.declarations
              ?.filter(decl => services.tsNodeToESTreeNodeMap.has(decl))
              .map(decl => services.tsNodeToESTreeNodeMap.get(decl)) ?? []
          );
          if (!declarationNode) return;

          callbackNode =
            /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | import('@typescript-eslint/utils').TSESTree.FunctionLike} */
            (isAccessorNode(declarationNode)
              ? declarationNode.value
              : declarationNode);

          break;
        }
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

      const isRejectCallbackNameDeclared =
        callbackNode.params.length >= 2;

      if (
        isPromiseConstructorCallback &&
        isRejectCallbackNameDeclared
      ) {
        const rejectCallbackNode = callbackNode.params[1];
        if (rejectCallbackNode.type !== AST_NODE_TYPES.Identifier) return;

        const argumentTypes =
          findFunctionCallNodes(sourceCode, rejectCallbackNode)
            .filter(expr => expr.arguments.length > 0)
            .map(expr => services.getTypeAtLocation(expr.arguments[0]));

        rejectTypes.add(
          promiseReturningFunction,
          toFlattenedTypeArray(argumentTypes)
        );
      }

      if (throwStatementsInFunction.has(getNodeID(callbackNode))) {
        const throwStatementTypes = throwStatementsInFunction
          .get(getNodeID(callbackNode))
          ?.map(n => services.getTypeAtLocation(n.argument));

        if (throwStatementTypes) {
          rejectTypes.add(
            promiseReturningFunction,
            toFlattenedTypeArray(throwStatementTypes)
          );
        }
      }

      const callbackThrowsTagTypes = getJSDocThrowsTagTypes(
        checker,
        services.esTreeNodeToTSNodeMap.get(callbackNode)
      );

      if (callbackThrowsTagTypes.length) {
        rejectTypes.add(
          promiseReturningFunction,
          toFlattenedTypeArray(callbackThrowsTagTypes)
        );
      }
    };

    return {
      /**
       * Each throws or throwable calls are collected when enter nodes,
       * then processed when function nodes exit
       * to efficiently avoid duplicate processing of the same nodes.
       */
      ThrowStatement(node) {
        if (isInHandledContext(node)) return; 

        const currentFunction = findClosestFunctionNode(node);
        if (!currentFunction) return;

        if (!throwStatementsInFunction.has(getNodeID(currentFunction))) {
          throwStatementsInFunction.set(getNodeID(currentFunction), []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatementsInFunction.get(getNodeID(currentFunction)));

        throwStatementNodes.push(node);
      },
      ':function MemberExpression[property.type="Identifier"]': visitFunctionCallNode,
      ':function CallExpression[callee.type="Identifier"]': visitFunctionCallNode,
      ':function AssignmentExpression[left.type="MemberExpression"]': visitFunctionCallNode,

      /**
       * @example
       * ```
       * new Promise(...)
       * //          ^ here
       * ```
       */
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > :function:first-child:exit':
        visitPromiseCallbackOnExit,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > Identifier:first-child:exit':
        visitPromiseCallbackOnExit,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > MemberExpression:first-child:exit':
        visitPromiseCallbackOnExit,
      /**
       * @example
       * ```
       * new Promise(...).then(...)
       * //                    ^ here
       * new Promise(...).finally(...)
       * //                       ^ or here
       * ```
       */
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > :function:first-child:exit':
        visitPromiseCallbackOnExit,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > Identifier:first-child:exit':
        visitPromiseCallbackOnExit,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > MemberExpression:first-child:exit':
        visitPromiseCallbackOnExit,

      /**
       * Process collected types when each function node exits
       */
      'FunctionDeclaration:exit': visitFunctionOnExit,
      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > :function:exit': visitFunctionOnExit,
      'Property > :function:exit': visitFunctionOnExit,
      'PropertyDefinition > :function:exit': visitFunctionOnExit,
      'ReturnStatement > :function:exit': visitFunctionOnExit,
      'MethodDefinition > :function:exit': visitFunctionOnExit,
    };
  },
});
