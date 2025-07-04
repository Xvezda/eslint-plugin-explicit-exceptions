// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  TypeMap,
  createRule,
  getNodeID,
  getFirst,
  getLast,
  getNodeIndent,
  isInHandledContext,
  isInAsyncHandledContext,
  isNodeReturned,
  isGeneratorLike,
  isPromiseType,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
  isAccessorNode,
  appendThrowsTags,
  hasJSDocThrowsTag,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  getCalleeDeclaration,
  findParent,
  findClosest,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  toFlattenedTypeArray,
  typesToUnionString,
  typeStringsToUnionString,
  getQualifiedTypeName,
  findFunctionCallNodes,
} = require('../utils');

/**
 * Groups an array of objects by a specified key or function.
 *
 * @template T
 * @template {string} K
 * @param {T[]} arr - The array to group.
 * @param {((item: T) => K)} key
 * @return {Record<K, T[] | undefined>}
 */
const groupBy = (arr, key) => {
  return arr.reduce((acc, item) => {
    const groupKey = key(item);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, /** @type {Record<string, T[]>} */(Object.create(null)));
};

/**
 * @typedef {{ compatible?: import('typescript').Type[]; incompatible?: import('typescript').Type[] }} G
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation['program']} program
 * @param {import('typescript').Type[]} source
 * @param {import('typescript').Type[]} target
 * @returns {{ source: G; target: G }}
 */
const groupTypesByCompatibility = (program, source, target) => {
  const checker = program.getTypeChecker();

  const sourceGroup = groupBy(source, sourceType => {
    const isCompatible = target.some(targetType => {
      if (
        utils.isErrorLike(program, sourceType) &&
        utils.isErrorLike(program, targetType)
      ) {
        return utils.typeIsOrHasBaseType(sourceType, targetType);
      }
      return checker.isTypeAssignableTo(sourceType, targetType);
    });
    return /** @type {'compatible'|'incompatible'} */(
      isCompatible ? 'compatible' : 'incompatible'
    );
  });

  const targetGroup = groupBy(target, targetType => {
    const isCompatible = source.some(sourceType => {
      if (
        utils.isErrorLike(program, sourceType) &&
        utils.isErrorLike(program, targetType)
      ) {
        return utils.typeIsOrHasBaseType(sourceType, targetType);
      }
      return checker.isTypeAssignableTo(sourceType, targetType);
    });
    return /** @type {'compatible'|'incompatible'} */(
      isCompatible ? 'compatible' : 'incompatible'
    );
  });

  return {
    source: sourceGroup,
    target: targetGroup,
  };
};

/**
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('typescript').Node | undefined}
 */
const getDeclarationTSNodeOfESTreeNode = (services, node) =>
  services
    .getTypeAtLocation(node)
    .symbol
    ?.valueDeclaration;

module.exports = createRule({
  name: 'check-throws-tag-type',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow type mismatches between JSDoc @throws tags and thrown exceptions',
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
          },
          preferUnionType: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    /** @type {{ useBaseTypeOfLiteral?: boolean; preferUnionType?: boolean }} */
    ({
      useBaseTypeOfLiteral: false,
      preferUnionType: true
    }),
  ],

  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;

    const {
      useBaseTypeOfLiteral = false,
      preferUnionType = true,
    } = context.options[0] ?? {};

    /** @type {Set<string>} */
    const visitedFunctionNodes = new Set();
    /** @type {Set<string>} */
    const visitedExpressionNodes = new Set();

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
     * @typedef {import('@typescript-eslint/utils').TSESTree.Node | import('typescript').Type} MetadataKey
     * @type {WeakMap<MetadataKey, { pos: number }>}
     */
    const metadata = new WeakMap();

    /**
     * @template {MetadataKey[]} T
     * @param {T} items
     */
    const toSortedByMetadata = (items) => {
      return [...items]
        .sort((a, b) => {
          const aPos = metadata.get(a)?.pos ?? 0;
          const bPos = metadata.get(b)?.pos ?? 0;
          return aPos - bPos;
        });
    };

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

      const callerDeclaration = findClosestFunctionNode(node.parent);
      if (!callerDeclaration) return;

      const calleeDeclaration = getCalleeDeclaration(services, node);
      if (!calleeDeclaration) return;

      const calleeThrowsTypes =
        getJSDocThrowsTagTypes(checker, calleeDeclaration);

      if (
        isPromiseConstructorCallbackNode(callerDeclaration) ||
        isThenableCallbackNode(callerDeclaration) ||
        calleeThrowsTypes
          .some(type => utils.isPromiseLike(services.program, type))
      ) {
        const awaitedTypes = calleeThrowsTypes
          .map(t => checker.getAwaitedType(t) ?? t);

        rejectTypes.add(callerDeclaration, awaitedTypes);

        awaitedTypes
          .forEach(type => metadata.set(type, { pos: node.range[0] }));
      } else {
        throwTypes.add(callerDeclaration, calleeThrowsTypes);

        calleeThrowsTypes
          .forEach(type => metadata.set(type, { pos: node.range[0] }));
      }
    };

    /**
     * Visit iterable node and collect types.
     *
     * @param {import('@typescript-eslint/utils').TSESTree.Node} node
     */
    const visitIterableNode = (node) => {
      const iterableType = services.getTypeAtLocation(node);
      if (!isGeneratorLike(iterableType)) return;

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      if (!ts.isExpression(services.esTreeNodeToTSNodeMap.get(node))) return;

      const calleeDeclaration =
        getCalleeDeclaration(
          services,
          /** @type {import('@typescript-eslint/utils').TSESTree.Expression} */
          (node)
        );

      if (!calleeDeclaration) return;

      const calleeThrowsTypes =
        getJSDocThrowsTagTypes(checker, calleeDeclaration);

      if (!calleeThrowsTypes.length) return;

      for (const type of calleeThrowsTypes) {
        if (isPromiseType(services, type)) {
          if (isInAsyncHandledContext(sourceCode, node)) continue;

          const flattened =
            toFlattenedTypeArray([checker.getAwaitedType(type) ?? type]);

          rejectTypes.add(callerDeclaration, flattened);

          flattened.forEach(t => metadata.set(t, { pos: node.range[0] }));
        } else {
          if (isInHandledContext(node)) continue;
          const flattened = toFlattenedTypeArray([type]);

          throwTypes.add(callerDeclaration, flattened);

          flattened.forEach(t => metadata.set(t, { pos: node.range[0] }));
        }
      }
    };

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitFunctionOnExit = (node) => {
      if (visitedFunctionNodes.has(getNodeID(node))) return;
      visitedFunctionNodes.add(getNodeID(node));

      const nodeToComment = findNodeToComment(node);
      if (!nodeToComment) return;

      if (!hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      const throwStatementNodes =
        throwStatementsInFunction.get(getNodeID(node));

      if (throwStatementNodes) {
        /** @type {import('typescript').Type[]} */
        const throwStatementTypes = [];

        for (const throwStatement of throwStatementNodes) {
          const throwType = services.getTypeAtLocation(throwStatement.argument);
          if (
            useBaseTypeOfLiteral &&
            ts.isLiteralTypeLiteral(
              services.esTreeNodeToTSNodeMap.get(throwStatement.argument)
            )
          ) {
            const type = checker.getBaseTypeOfLiteralType(throwType);
            throwStatementTypes.push(type);
            metadata.set(type, { pos: throwStatement.range[0] });
          } else {
            throwStatementTypes.push(throwType);
            metadata.set(throwType, { pos: throwStatement.range[0] });
          }
        }
        throwTypes.add(node, throwStatementTypes);

        if (!services.esTreeNodeToTSNodeMap.has(nodeToComment)) return;

        const functionDeclarationTSNode =
          services.esTreeNodeToTSNodeMap.get(node);

        const throwsTags = getJSDocThrowsTags(functionDeclarationTSNode);
        const throwsTagTypeNodes = throwsTags
          .map(tag => tag.typeExpression?.type)
          // Only keep throws tag with type defined
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
      }

      const throwableTypes =
        node.async
          ? []
          : toFlattenedTypeArray(
            /** @type {import('typescript').Type[]} */(
            throwTypes.get(node)
              ?.map(t => checker.getAwaitedType(t) ?? t)
            )
          );

      const rejectableTypes =
        node.async
          ? toFlattenedTypeArray(
            [
              ...throwTypes.get(node)
                ?.map(t => checker.getAwaitedType(t) ?? t),
              ...rejectTypes.get(node)
                ?.map(t => checker.getAwaitedType(t) ?? t)
            ]
          )
          : toFlattenedTypeArray(
            /** @type {import('typescript').Type[]} */(
              rejectTypes.get(node)
              ?.map(t => checker.getAwaitedType(t) ?? t)
            )
          );

      if (
        !throwableTypes.length &&
        !rejectableTypes.length
      ) return;

      const callerDeclarationTSNode =
        getDeclarationTSNodeOfESTreeNode(services, node);

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

      const indent = getNodeIndent(sourceCode, node);

      // If all callee thrown types are compatible with caller's throws tags,
      // we don't need to report anything
      if (
        !throwTypeGroups.source.incompatible &&
        !rejectTypeGroups.source.incompatible
      ) return;

      // Thrown types inside async function should be wrapped into Promise
      if (node.async) {
        if (preferUnionType) {
          context.report({
            node,
            messageId: 'throwTypeMismatch',
            fix(fixer) {
              return fixer.replaceTextRange(
                [lastThrowsTypeNode.getStart(), lastThrowsTypeNode.getEnd()],
                `Promise<${
                  typesToUnionString(
                    checker,
                    toSortedByMetadata([
                      ...throwableTypes,
                      ...rejectableTypes,
                    ]),
                    { useBaseTypeOfLiteral }
                  )
                }>`);
            },
          });
          return;
        }

        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [lastThrowsTypeNode.getStart(), lastThrowsTypeNode.getEnd()],
              toSortedByMetadata([ ...throwableTypes, ...rejectableTypes ])
                .map(t =>
                  `Promise<${
                    getQualifiedTypeName(checker, t, { useBaseTypeOfLiteral })
                  }>`
                )
                .join(`}\n${indent} * @throws {`)
            );
          },
        });
        return;
      }

      const lastThrowsTag = getLast(documentedThrowsTags);
      if (!lastThrowsTag) return;

      if (documentedThrowsTags.length > 1) {
        const callerJSDocTSNode = lastThrowsTag.parent;
        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [callerJSDocTSNode.getStart(), callerJSDocTSNode.getEnd()],
              appendThrowsTags(
                appendThrowsTags(
                  callerJSDocTSNode.getFullText(),
                  toSortedByMetadata([...throwTypeGroups.source.incompatible ?? []])
                    .map(t =>
                      getQualifiedTypeName(checker, t, { useBaseTypeOfLiteral })
                    )
                ),
                toSortedByMetadata([...rejectTypeGroups.source.incompatible ?? []])
                  .map(t =>
                    `Promise<${
                      getQualifiedTypeName(checker, t, { useBaseTypeOfLiteral })
                    }>`)
              )
            );
          },
        });
        return;
      }

      if (preferUnionType) {
        context.report({
          node,
          messageId: 'throwTypeMismatch',
          fix(fixer) {
            return fixer.replaceTextRange(
              [lastThrowsTypeNode.getStart(), lastThrowsTypeNode.getEnd()],
              node.async
                ? `Promise<${
                  typesToUnionString(
                    checker,
                    toSortedByMetadata([...throwableTypes, ...rejectableTypes]),
                    { useBaseTypeOfLiteral }
                  )
                }>`
                : typeStringsToUnionString([
                  throwableTypes.length
                    ? typesToUnionString(
                      checker, toSortedByMetadata(throwableTypes),
                      { useBaseTypeOfLiteral }
                    )
                    : '',
                  rejectableTypes.length
                    ? `Promise<${
                      typesToUnionString(
                        checker,
                        toSortedByMetadata(rejectableTypes),
                        { useBaseTypeOfLiteral }
                      )}>`
                    : '',
                ].filter(t => !!t))
            );
          },
        });
        return;
      }

      context.report({
        node,
        messageId: 'throwTypeMismatch',
        fix(fixer) {
          return fixer.replaceTextRange(
            [lastThrowsTypeNode.getStart(), lastThrowsTypeNode.getEnd()],
            toSortedByMetadata(throwableTypes)
              .map(t =>
                getQualifiedTypeName(checker, t, { useBaseTypeOfLiteral })
              )
              .join(`}\n${indent} * @throws {`) +
            toSortedByMetadata(rejectableTypes)
              .map(t =>
                `Promise<${
                  getQualifiedTypeName(checker, t, { useBaseTypeOfLiteral })
                }>`
              )
              .join(`}\n${indent} * @throws {`)
          );
        },
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
          isNodeReturned(node.parent.parent)
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
          const declaration = getFirst(
            propertySymbol
              ?.declarations
              ?.filter(decl => services.tsNodeToESTreeNodeMap.has(decl))
              .map(decl => services.tsNodeToESTreeNodeMap.get(decl)) ?? []
          );
          if (!declaration) return;

          callbackNode =
            /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike} */
            (isAccessorNode(declaration)
              ? declaration.value
              : declaration);

          break;
        }
        case AST_NODE_TYPES.Identifier: {
          const declaration =
            findIdentifierDeclaration(sourceCode, node);

          if (!declaration) return;

          callbackNode =
            /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */
            (declaration);
          break;
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

        const functionCallNodes =
          findFunctionCallNodes(sourceCode, rejectCallbackNode)
            .filter(expr => expr.arguments.length > 0);

        const argumentTypes =
          functionCallNodes
            .map(expr => services.getTypeAtLocation(expr.arguments[0]));

        argumentTypes.forEach((type, i) => {
          const flattenedTypes = toFlattenedTypeArray([type]);

          rejectTypes
            .add(
              promiseReturningFunction,
              flattenedTypes,
            );

          flattenedTypes
            .forEach(t => {
              metadata.set(t, { pos: functionCallNodes[i].range[0] });
            });
        });
      }

      if (throwStatementsInFunction.has(getNodeID(callbackNode))) {
        const throwStatementTypes = throwStatementsInFunction
          .get(getNodeID(callbackNode))
          ?.map(n => services.getTypeAtLocation(n.argument));

        if (throwStatementTypes) {
          const flattenedTypes = toFlattenedTypeArray(throwStatementTypes);

          rejectTypes
            .add(promiseReturningFunction, flattenedTypes);

          flattenedTypes
            .forEach(t => {
              metadata.set(t, { pos: callbackNode.range[0] });
            });
        }
      }

      const callbackThrowsTagTypes = getJSDocThrowsTagTypes(
        checker,
        services.esTreeNodeToTSNodeMap.get(callbackNode)
      );

      if (callbackThrowsTagTypes.length) {
        const flattenedTypes = 
          toFlattenedTypeArray(callbackThrowsTagTypes);

        rejectTypes.add(
          promiseReturningFunction,
          flattenedTypes,
        );

        flattenedTypes.forEach(t => {
          metadata.set(t, { pos: callbackNode.range[0] });
        });
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
        metadata.set(node, { pos: node.range[0] });
      },
      ':function NewExpression[callee.type="Identifier"]':
        visitFunctionCallNode,
      ':function CallExpression[callee.type="Identifier"]':
        visitFunctionCallNode,
      ':function MemberExpression[property.type="Identifier"]':
        visitFunctionCallNode,
      ':function AssignmentExpression[left.type="MemberExpression"]':
        visitFunctionCallNode,

      /**
       * @example
       * ```
       * new Promise(...)
       * //          ^ here
       * ```
       */
      'NewExpression[callee.name="Promise"] > :function:first-child:exit':
        visitPromiseCallbackOnExit,
      'NewExpression[callee.name="Promise"] > Identifier:first-child:exit':
        visitPromiseCallbackOnExit,
      'NewExpression[callee.name="Promise"] > MemberExpression:first-child:exit':
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
      'CallExpression[callee.property.name=/^(then|finally)$/] > :function:first-child:exit':
        visitPromiseCallbackOnExit,
      'CallExpression[callee.property.name=/^(then|finally)$/] > Identifier:first-child:exit':
        visitPromiseCallbackOnExit,
      'CallExpression[callee.property.name=/^(then|finally)$/] > MemberExpression:first-child:exit':
        visitPromiseCallbackOnExit,

      /**
       * Collect throwable types of generators
       */
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of MDN}
       * @example
       * ```
       * for (const item of iterable) { ... }
       * //                 ^ this
       * for await (const item of iterable) { ... }
       * //                       ^ or this
       * ```
       */
      'ForOfStatement'(node) {
        visitIterableNode(node.right);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax MDN}
       * @example
       * ```
       * [...iterable]
       * //  ^ this
       * ```
       */
      'SpreadElement'(node) {
        visitIterableNode(node.argument);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from MDN}
       * @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node
       * @example
       * ```
       * Array.from(iterable)
       * //         ^ this
       * ```
       */
      'CallExpression:has(> MemberExpression[object.name="Array"][property.name="from"])'(node) {
        if (node.arguments.length < 1) return;

        const [firstArgumentNode] = node.arguments;

        visitIterableNode(firstArgumentNode);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync MDN}
       * @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node
       * @example
       * ```
       * await Array.fromAsync(iterable)
       * //                    ^ this
       * ```
       */
      'CallExpression:has(> MemberExpression[object.name="Array"][property.name="fromAsync"])'(node) {
        if (node.arguments.length < 1) return;

        const [firstArgumentNode] = node.arguments;

        visitIterableNode(firstArgumentNode);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield* MDN}
       * @param {import('@typescript-eslint/utils').TSESTree.YieldExpression} node
       * @example
       * ```
       * function* gen() {
       *   yield* iterable;
       *   //     ^ this
       * }
       * // or
       * async function* asyncGen() {
       *   yield* iterable;
       *   //     ^ this
       * }
       * ```
       */
      'YieldExpression[delegate=true]'(node) {
        if (!node.argument) return;

        visitIterableNode(node.argument);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/next MDN}
       * @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node
       * @example
       * ```
       * iterable.next();
       * //       ^ this
       * ```
       */
      'CallExpression[callee.property.name="next"]'(node) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;

        visitIterableNode(node.callee.object);
      },

      /**
       * Process collected types when each function node exits
       */
      'FunctionDeclaration:exit': visitFunctionOnExit,
      'VariableDeclaration > VariableDeclarator[id.type="Identifier"] > :function:exit':
        visitFunctionOnExit,
      'Property > :function:exit': visitFunctionOnExit,
      'PropertyDefinition > :function:exit': visitFunctionOnExit,
      'ReturnStatement > :function:exit': visitFunctionOnExit,
      'MethodDefinition > :function:exit': visitFunctionOnExit,
    };
  },
});

