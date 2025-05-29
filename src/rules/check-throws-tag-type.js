// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  TypeMap,
  createRule,
  getNodeID,
  getLast,
  isInHandledContext,
  isInAsyncHandledContext,
  isPromiseType,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
  hasJSDocThrowsTag,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  getCalleeDeclaration,
  getDeclarationTSNodeOfESTreeNode,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  toFlattenedTypeArray,
  typesToUnionString,
  groupTypesByCompatibility,
  findFunctionCallNodes,
} = require('../utils');


module.exports = createRule({
  name: 'check-throws-tag-type',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow type mismatches between JSDoc @throws tags and thrown exceptions',
    },
    fixable: 'code',
    messages: {
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
      if (visitedFunctionNodes.has(getNodeID(node))) return;
      visitedFunctionNodes.add(getNodeID(node));

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

      if (!hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      const throwStatementNodes =
        throwStatements.get(getNodeID(node));

      if (throwStatementNodes) {
        /** @type {import('typescript').Type[]} */
        const throwStatementTypes =
          toFlattenedTypeArray(
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
              })
          )
          .map(t => checker.getAwaitedType(t) ?? t);

        if (!services.esTreeNodeToTSNodeMap.has(nodeToComment)) return;

        const functionDeclarationTSNode =
          services.esTreeNodeToTSNodeMap.get(node);

        const throwsTags = getJSDocThrowsTags(functionDeclarationTSNode);
        const throwsTagTypeNodes = throwsTags
          .map(tag => tag.typeExpression?.type)
          .filter(tag => !!tag);

        if (!throwsTagTypeNodes.length) return;

        const throwsTagTypes =
          getJSDocThrowsTagTypes(checker, functionDeclarationTSNode)
            .map(t => checker.getAwaitedType(t) ?? t);

        const typeGroups = groupTypesByCompatibility(
          services.program,
          throwStatementTypes,
          throwsTagTypes,
        );
        if (!typeGroups.source.incompatible) return;

        const lastTagtypeNode = getLast(throwsTagTypeNodes);
        if (!lastTagtypeNode) return;

        throwTypes.add(nodeToComment, throwStatementTypes);
      }

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const throwableTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
          throwTypes.get(callerDeclaration)
            ?.map(t => checker.getAwaitedType(t) ?? t)
          )
        );

      const rejectableTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
          rejectTypes.get(callerDeclaration)
            ?.map(t => checker.getAwaitedType(t) ?? t)
          )
        );

      if (!throwableTypes && !rejectableTypes) return;

      const callerDeclarationTSNode =
        getDeclarationTSNodeOfESTreeNode(services, callerDeclaration);

      if (!callerDeclarationTSNode) return;

      const documentedThrowsTags = getJSDocThrowsTags(callerDeclarationTSNode);
      const documentedThrowsTypeNodes =
        documentedThrowsTags
          .map(tag => tag.typeExpression?.type)
          .filter(tag => !!tag);

      if (!documentedThrowsTypeNodes.length) return;

      const documentedThrowTypes =
        toFlattenedTypeArray(
          getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
            .filter(type => !isPromiseType(services, type))
        );

      const documentedRejectTypes =
        toFlattenedTypeArray(
          getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
            .filter(type => isPromiseType(services, type))
            // Get awaited type for comparison
            .map(t => checker.getAwaitedType(t) ?? t)
        );

      const throwTypeGroups = groupTypesByCompatibility(
        services.program,
        throwableTypes,
        documentedThrowTypes,
      );

      const rejectTypeGroups = groupTypesByCompatibility(
        services.program,
        rejectableTypes,
        documentedRejectTypes,
      );

      const lastThrowsTypeNode = getLast(documentedThrowsTypeNodes);
      if (!lastThrowsTypeNode) return;

      // Thrown types inside async function should be wrapped into Promise
      if (
        node.async &&
        !getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
          .every(type => isPromiseType(services, type))
      ) {
        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [lastThrowsTypeNode.pos, lastThrowsTypeNode.end],
              `Promise<${
                typesToUnionString(
                  checker,
                  [
                    ...throwTypeGroups.target.compatible ?? [],
                    ...throwTypeGroups.source.incompatible ?? [],
                    ...rejectTypeGroups.target.compatible ?? [],
                    ...rejectTypeGroups.source.incompatible ?? [],
                  ]
                )
              }>`,
            );
          },
        });
        return;
      }

      // If all callee thrown types are compatible with caller's throws tags,
      // we don't need to report anything
      if (
        !throwTypeGroups.source.incompatible &&
        !rejectTypeGroups.source.incompatible
      ) return;

      const lastThrowsTag = getLast(documentedThrowsTags);
      if (!lastThrowsTag) return;

      if (documentedThrowsTags.length > 1) {
        const callerJSDocTSNode = lastThrowsTag.parent;
        /**
         * @param {string} jsdocString
         * @param {string[]} typeStrings
         * @returns {string}
         */
        const appendThrowsTags = (jsdocString, typeStrings) =>
          typeStrings.reduce((acc, typeString) =>
            acc.replace(
              /([^*\n]+)(\*+[/])/,
              `$1* @throws {${typeString}}\n$1$2`
            ),
            jsdocString
          );

        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [callerJSDocTSNode.getStart(), callerJSDocTSNode.getEnd()],
              appendThrowsTags(
                appendThrowsTags(
                  callerJSDocTSNode.getFullText(),
                  [...throwTypeGroups.source.incompatible ?? []]
                    .map(t => utils.getTypeName(checker, t))
                ),
                [...rejectTypeGroups.source.incompatible ?? []]
                  .map(t => `Promise<${utils.getTypeName(checker, t)}>`)
              )
            );
          },
        });
        return;
      }

      context.report({
        node,
        messageId: 'throwTypeMismatch',
        fix(fixer) {
          const throwTypes = [
            ...throwTypeGroups.target.compatible ?? [],
            ...throwTypeGroups.source.incompatible ?? [],
          ];

          const rejectTypes = [
            ...rejectTypeGroups.target.compatible ?? [],
            ...rejectTypeGroups.source.incompatible ?? [],
          ];

          // If there is only one throws tag, make it as a union type
          return fixer.replaceTextRange(
            [lastThrowsTypeNode.pos, lastThrowsTypeNode.end],
            node.async
              ? `Promise<${
                typesToUnionString(checker, [...throwTypes, ...rejectTypes])
              }>`
              : [
                throwTypes.length
                  ? typesToUnionString(
                    checker, throwTypes,
                  )
                  : '',
                rejectTypes.length
                  ? `Promise<${
                    typesToUnionString(
                      checker,
                      rejectTypes,
                    )}>`
                  : '',
              ].filter(t => !!t).join(' | ')
          );
        },
      });
    };

    /**
     * @typedef {import('@typescript-eslint/utils').TSESTree.FunctionLike | import('@typescript-eslint/utils').TSESTree.Identifier} PromiseCallbackType
     * @param {PromiseCallbackType} node
     */
    const visitPromiseCallback = (node) => {
      if (isInAsyncHandledContext(sourceCode, node)) return;

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

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

        const argumentTypes =
          findFunctionCallNodes(sourceCode, rejectCallbackNode)
            .filter(expr => expr.arguments.length > 0)
            .map(expr => services.getTypeAtLocation(expr.arguments[0]));

        rejectTypes.add(
          nodeToComment,
          toFlattenedTypeArray(argumentTypes)
        );
      }

      if (throwStatements.has(getNodeID(callbackNode))) {
        const throwStatementTypes = throwStatements
          .get(getNodeID(callbackNode))
          ?.map(n => services.getTypeAtLocation(n.argument));

        if (throwStatementTypes) {
          rejectTypes.add(
            nodeToComment,
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
          nodeToComment,
          toFlattenedTypeArray(callbackThrowsTagTypes)
        );
      }
    };

    return {
      ThrowStatement(node) {
        if (isInHandledContext(node)) return; 

        const currentFunction = findClosestFunctionNode(node);
        if (!currentFunction) return;

        if (!throwStatements.has(getNodeID(currentFunction))) {
          throwStatements.set(getNodeID(currentFunction), []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatements.get(getNodeID(currentFunction)));

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
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > :function:first-child':
        visitPromiseCallback,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > Identifier:first-child':
        visitPromiseCallback,
      /**
       * @example
       * ```
       * new Promise(...).then(...)
       * //                    ^ here
       * new Promise(...).finally(...)
       * //                       ^ or here
       * ```
       */
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > :function:first-child':
        visitPromiseCallback,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > Identifier:first-child':
        visitPromiseCallback,

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

