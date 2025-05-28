// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
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
} = require('../utils');


class TypeMap {
  constructor() {
    /**
     * @type {Map<string, import('typescript').Type[]>}
     */
    this.map = new Map();
  }

  /**
   * @param {import('@typescript-eslint/utils').TSESTree.Node} node
   * @param {import('typescript').Type[]} types
   */
  add(node, types) {
    const key = getNodeID(node);
    if (!this.map.has(key)) {
      this.map.set(key, []);
    }
    return this.map.get(key)?.push(...types);
  }

  /**
   * @param {import('@typescript-eslint/utils').TSESTree.Node} node
   */
  get(node) {
    return this.map.get(getNodeID(node)) ?? [];
  }

  /**
   * @param {import('@typescript-eslint/utils').TSESTree.Node} node
   */
  has(node) {
    return this.map.has(getNodeID(node));
  }
}

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
      const functionDeclaration = findClosestFunctionNode(node);
      if (!functionDeclaration) return;

      if (visitedFunctionNodes.has(getNodeID(functionDeclaration))) return;
      visitedFunctionNodes.add(getNodeID(functionDeclaration));

      const nodeToComment = findNodeToComment(functionDeclaration);
      if (!nodeToComment) return;

      if (!hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      const throwStatementNodes =
        throwStatements.get(getNodeID(functionDeclaration));

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

        if (!services.esTreeNodeToTSNodeMap.has(nodeToComment)) return;

        const functionDeclarationTSNode =
          services.esTreeNodeToTSNodeMap.get(functionDeclaration);

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

      if (!calleeThrowTypes && !calleeRejectTypes) return;

      const callerDeclarationTSNode =
        getDeclarationTSNodeOfESTreeNode(services, callerDeclaration);

      if (!callerDeclarationTSNode) return;

      const callerThrowsTags = getJSDocThrowsTags(callerDeclarationTSNode);
      const callerThrowsTypeNodes =
        callerThrowsTags
          .map(tag => tag.typeExpression?.type)
          .filter(tag => !!tag);

      if (!callerThrowsTypeNodes.length) return;

      const callerThrowTypes =
        toFlattenedTypeArray(
          getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
            .filter(type => !isPromiseType(services, type))
        );

      const callerRejectTypes =
        toFlattenedTypeArray(
          getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
            .filter(type => isPromiseType(services, type))
            // Get awaited type for comparison
            .map(t => checker.getAwaitedType(t) ?? t)
        );

      const throwTypeGroups = groupTypesByCompatibility(
        services.program,
        calleeThrowTypes,
        callerThrowTypes,
      );

      const rejectTypeGroups = groupTypesByCompatibility(
        services.program,
        calleeRejectTypes,
        callerRejectTypes,
      );

      const lastThrowsTypeNode = getLast(callerThrowsTypeNodes);
      if (!lastThrowsTypeNode) return;

      // All thrown types must be documented as promise if it's in called async function
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

      const lastThrowsTag = getLast(callerThrowsTags);
      if (!lastThrowsTag) return;

      if (callerThrowsTags.length > 1) {
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
              // `$1* @throws {${utils.getTypeName(checker, t)}}\n$1$2`
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
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > ArrowFunctionExpression:first-child':
        visitPromiseCallback,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > FunctionExpression:first-child':
        visitPromiseCallback,
      'NewExpression[callee.type="Identifier"][callee.name="Promise"] > Identifier:first-child':
        visitPromiseCallback,
      /**
       * ```
       * new Promise(...).then(...)
       * //                    ^ here
       * new Promise(...).finally(...)
       * //                       ^ or here
       * ```
       */
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > ArrowFunctionExpression:first-child':
        visitPromiseCallback,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > FunctionExpression:first-child':
        visitPromiseCallback,
      'CallExpression[callee.type="MemberExpression"][callee.property.type="Identifier"][callee.property.name=/^(then|finally)$/] > Identifier:first-child':
        visitPromiseCallback,

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

