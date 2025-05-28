// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  TypeMap,
  getNodeID,
  createRule,
  hasJSDocThrowsTag,
  typesToUnionString,
  isInHandledContext,
  isInAsyncHandledContext,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
  getCalleeDeclaration,
  getJSDocThrowsTagTypes,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
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
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;

    const {
      useBaseTypeOfLiteral = false,
    } = context.options[0] ?? {};

    /** @type {Set<string>} */
    const visitedFunctionNodes = new Set();
    /** @type {Set<string>} */
    const visitedExpressionNodes = new Set();

    /**
     * Group throw statements in functions
     * @type {Map<string, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatements = new Map();

    /**
     * Group callee throws types by caller declaration.
     */
    const throwTypes = new TypeMap();

    /**
     * Types which thrown or rejected and should be wrapped into `Promise<...>` later
     */
    const rejectTypes = new TypeMap();

    /** @param {import('@typescript-eslint/utils').TSESTree.Expression} node */
    const visitExpression = (node) => {
      if (visitedExpressionNodes.has(getNodeID(node))) return;
      visitedExpressionNodes.add(getNodeID(node));

      if (isInHandledContext(node)) return;

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const calleeDeclaration = getCalleeDeclaration(services, node);
      if (!calleeDeclaration) return;

      const calleeThrowsTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
      if (!calleeThrowsTypes.length) return;

      const nodeToComment = findNodeToComment(callerDeclaration);
      if (!nodeToComment) return;

      throwTypes.add(nodeToComment, calleeThrowsTypes);
    };

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitFunctionOnExit = (node) => {
      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      if (visitedFunctionNodes.has(getNodeID(callerDeclaration))) return;
      visitedFunctionNodes.add(getNodeID(callerDeclaration));

      const nodeToComment = findNodeToComment(callerDeclaration);
      if (!nodeToComment) return;

      const throwStatementNodes =
        throwStatements.get(getNodeID(callerDeclaration));

      if (throwStatementNodes) {
        /** @type {import('typescript').Type[]} */
        const throwStatementTypes =
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

        throwTypes.add(callerDeclaration, throwStatementTypes);
      }

      const calleeThrowTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
          throwTypes.get(callerDeclaration)
            ?.map(t => checker.getAwaitedType(t) ?? t)
          )
        );

      const calleeRejectTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
          rejectTypes.get(callerDeclaration)
            ?.map(t => checker.getAwaitedType(t) ?? t)
          )
        );

      if (
        !calleeThrowTypes.length &&
        !calleeRejectTypes.length
      ) return;

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      context.report({
        node: nodeToComment,
        messageId: 'missingThrowsTag',
        fix(fixer) {
          const lines = sourceCode.getLines();
          const currentLine = lines[node.loc.start.line - 1];
          const indent = currentLine.match(/^\s*/)?.[0] ?? '';

          const newType =
            node.async
            ? `Promise<${typesToUnionString(checker, [
              ...calleeThrowTypes,
              ...calleeRejectTypes,
            ])}>`
            : [
              ...calleeThrowTypes.length
              ? [typesToUnionString(checker, calleeThrowTypes)]
              : [],
              ...calleeRejectTypes.length
              ? [`Promise<${typesToUnionString(checker, calleeRejectTypes)}>`]
              : [],
            ].join(' | ');

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
     * @typedef {import('@typescript-eslint/utils').TSESTree.FunctionLike | import('@typescript-eslint/utils').TSESTree.Identifier} PromiseCallbackType
     * @param {PromiseCallbackType} node
     */
    const visitPromiseCallbackOnExit = (node) => {
      if (isInAsyncHandledContext(sourceCode, node.parent)) return;

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

      const functionDeclaration = findClosestFunctionNode(nodeToComment);
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

      const isRejectCallbackNameDeclared =
        callbackNode.params.length >= 2;

      if (
        isPromiseConstructorCallback &&
        isRejectCallbackNameDeclared
      ) {
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

        rejectTypes.add(
          functionDeclaration,
          toFlattenedTypeArray(argumentTypes)
        );
      }

      if (throwStatements.has(getNodeID(callbackNode))) {
        const throwStatementTypes = throwStatements
          .get(getNodeID(callbackNode))
          ?.map(n => services.getTypeAtLocation(n.argument));

        if (throwStatementTypes) {
          rejectTypes.add(
            functionDeclaration,
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
          functionDeclaration,
          toFlattenedTypeArray(callbackThrowsTagTypes)
        );
      }
    };

    return {
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
      'ArrowFunctionExpression MemberExpression[property.type="Identifier"]': visitExpression,
      'FunctionDeclaration MemberExpression[property.type="Identifier"]': visitExpression,
      'FunctionExpression MemberExpression[property.type="Identifier"]': visitExpression,
      'ArrowFunctionExpression CallExpression[callee.type="Identifier"]': visitExpression,
      'FunctionDeclaration CallExpression[callee.type="Identifier"]': visitExpression,
      'FunctionExpression CallExpression[callee.type="Identifier"]': visitExpression,
      'ArrowFunctionExpression AssignmentExpression[left.type="MemberExpression"]': visitExpression,
      'FunctionDeclaration AssignmentExpression[left.type="MemberExpression"]': visitExpression,
      'FunctionExpression AssignmentExpression[left.type="MemberExpression"]': visitExpression,

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

      'FunctionDeclaration:exit': visitFunctionOnExit,
      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > ArrowFunctionExpression:exit': visitFunctionOnExit,
      'Property > ArrowFunctionExpression:exit': visitFunctionOnExit,
      'PropertyDefinition > ArrowFunctionExpression:exit': visitFunctionOnExit,
      'ReturnStatement > ArrowFunctionExpression:exit': visitFunctionOnExit,

      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > FunctionExpression:exit': visitFunctionOnExit,
      'Property > FunctionExpression:exit': visitFunctionOnExit,
      'PropertyDefinition > FunctionExpression:exit': visitFunctionOnExit,
      'MethodDefinition > FunctionExpression:exit': visitFunctionOnExit,
      'ReturnStatement > FunctionExpression:exit': visitFunctionOnExit,
    };
  },
});
