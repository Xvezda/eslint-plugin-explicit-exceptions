// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');
const {
  TypeMap,
  getNodeID,
  getNodeIndent,
  getFirst,
  getCallee,
  createRule,
  appendThrowsTags,
  hasJSDoc,
  hasJSDocThrowsTag,
  typesToUnionString,
  typeStringsToUnionString,
  isInHandledContext,
  isInAsyncHandledContext,
  isGeneratorLike,
  isPromiseType,
  isNodeReturned,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
  isAccessorNode,
  getCallSignature,
  getCallSignatureDeclaration,
  getCalleeDeclaration,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  getQualifiedTypeName,
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
          preferUnionType: {
            type: 'boolean',
            default: true,
          }
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    /** @type {{ useBaseTypeOfLiteral?: boolean; preferUnionType?: boolean }} */
    ({
      useBaseTypeOfLiteral: false,
      preferUnionType: true,
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
     * @type {Map<string, import('typescript').JSDocThrowsTag[]>}
     */
    const throwsComments = new Map();

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
      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const calleeDeclaration =
        (node.type === AST_NODE_TYPES.CallExpression ||
         node.type === AST_NODE_TYPES.NewExpression)
          ? getCallSignatureDeclaration(services, node)
          : node.parent?.type === AST_NODE_TYPES.CallExpression
          ? getCallSignatureDeclaration(services, node.parent)
          : getCalleeDeclaration(services, node);

      if (!calleeDeclaration) return;

      const signature = getCallSignature(
        services,
        services.tsNodeToESTreeNodeMap.get(calleeDeclaration)
      );

      const returnType = signature?.getReturnType();
      if (returnType && isGeneratorLike(returnType)) return;

      /** @type {import('typescript').JSDocThrowsTag[]} */
      const comments = [];
      comments.push(...getJSDocThrowsTags(calleeDeclaration));

      const calleeThrowsTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
      for (const type of calleeThrowsTypes) {
        if (isPromiseType(services, type)) {
          if (isInAsyncHandledContext(sourceCode, node)) continue;

          const isPromiseReturned =
            // Promise is assigned and returned
            sourceCode.getScope(node.parent)
            ?.references
            .map(ref => ref.identifier)
            .some(n => findClosest(n, isNodeReturned));

          if (!isPromiseReturned) continue;

          const flattened =
            toFlattenedTypeArray([checker.getAwaitedType(type) ?? type]);

          rejectTypes.add(callerDeclaration, flattened);

          flattened
            .forEach(t => metadata.set(t, { pos: node.range[0] }));
        } else {
          if (isInHandledContext(node)) continue;
          const flattened = toFlattenedTypeArray([type]);

          throwTypes.add(callerDeclaration, flattened);

          flattened
            .forEach(t => metadata.set(t, { pos: node.range[0] }));
        }
      };
      throwsComments.set(getNodeID(callerDeclaration), comments);
    };

    /**
     * Visit iterable node and collect types.
     *
     * @param {import('@typescript-eslint/utils').TSESTree.Node} node
     */
    const visitIterableNode = (node) => {
      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const calleeNode = getCallee(node);
      if (!calleeNode) return;

      // TODO: Extract duplicated logic of extracting narrowed type declaration
      const calleeDeclaration =
        (calleeNode.type === AST_NODE_TYPES.CallExpression ||
          calleeNode.type === AST_NODE_TYPES.NewExpression)
        ? getCallSignatureDeclaration(services, calleeNode)
        : calleeNode.parent?.type === AST_NODE_TYPES.CallExpression
        ? getCallSignatureDeclaration(services, calleeNode.parent)
        : getCalleeDeclaration(
          services,
          /** @type {import('@typescript-eslint/utils').TSESTree.Expression} */
          (calleeNode)
        );

      if (!calleeDeclaration) return;

      const calleeThrowsTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
      if (!calleeThrowsTypes.length) return;

      for (const type of calleeThrowsTypes) {
        const flattened = toFlattenedTypeArray([type]);

        throwTypes.add(callerDeclaration, flattened);

        flattened
          .forEach(t => metadata.set(t, { pos: node.range[0] }));
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

        awaitedTypes
          .forEach(t => metadata.set(t, { pos: nodeToComment.range[0] }));
      }

      const throwableTypes = throwTypes.get(node) ?? [];
      const rejectableTypes = rejectTypes.get(node) ?? [];

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      if (
        !throwableTypes.length &&
        !rejectableTypes.length
      ) {
        // At least there is untyped throws tag
        const untypedThrowsTags = (throwsComments.get(getNodeID(node)) ?? [])
          .filter(tag => !tag.typeExpression?.type);

        if (untypedThrowsTags.length) {
          context.report({
            node: nodeToComment,
            messageId: 'missingThrowsTag',
            fix(fixer) {
              const indent = getNodeIndent(sourceCode, node);

              if (hasJSDoc(sourceCode, nodeToComment)) {
                const comments = sourceCode.getCommentsBefore(nodeToComment);
                const comment = comments
                  .find(({ value }) => value.trim().startsWith('*'));

                if (comment) {
                  let newCommentText = sourceCode.getText(comment);
                  if (!/^\/\*\*[ \t]*\n/.test(newCommentText)) {
                    newCommentText = newCommentText
                      .replace(/^\/\*\*\s*/, `/**\n${indent} * `)
                      .replace(/\s*\*\/$/, `\n${indent} * @throws\n${indent} */`)
                  } else {
                    newCommentText = newCommentText.replace(
                      /([^*\n]+)(\*+[/])/,
                      `$1* @throws\n$1$2`
                    );
                  }
                  return fixer.replaceTextRange(
                    comment.range,
                    newCommentText,
                  );
                }
              }

              return fixer
                .insertTextBefore(
                  nodeToComment,
                  `/**\n` +
                  `${indent} * @throws\n` +
                  `${indent} */\n` +
                  `${indent}`
                );
            }
          });
        }
        return;
      }

      if (preferUnionType) {
        context.report({
          node: nodeToComment,
          messageId: 'missingThrowsTag',
          fix(fixer) {
            const newType = 
              node.async
                ? `Promise<${
                  typesToUnionString(
                    checker,
                    toSortedByMetadata([
                      ...throwableTypes,
                      ...rejectableTypes,
                    ]),
                    { useBaseTypeOfLiteral }
                  )
                }>`
                : typeStringsToUnionString([
                  ...throwableTypes.length
                    ? [
                      typesToUnionString(
                        checker,
                        toSortedByMetadata(throwableTypes),
                        { useBaseTypeOfLiteral }
                      )
                    ]
                    : [],
                  ...rejectableTypes.length
                    ? [
                      `Promise<${
                        typesToUnionString(
                          checker,
                          toSortedByMetadata(rejectableTypes),
                          { useBaseTypeOfLiteral }
                        )
                      }>`
                    ]
                    : [],
                ]);

            const indent = getNodeIndent(sourceCode, node);

            if (hasJSDoc(sourceCode, nodeToComment)) {
              const comments = sourceCode.getCommentsBefore(nodeToComment);
              const comment = comments
                .find(({ value }) => value.startsWith('*'));

              if (comment) {
                let newCommentText = sourceCode.getText(comment);
                if (!/^\/\*\*[ \t]*\n/.test(newCommentText)) {
                  newCommentText = newCommentText
                    .replace(/^\/\*\*\s*/, `/**\n${indent} * `)
                    .replace(/\s*\*\/$/, `\n${indent} * @throws {${newType}}\n${indent} */`)
                } else {
                  newCommentText = appendThrowsTags(
                    newCommentText,
                    [newType],
                  );
                }
                return fixer.replaceTextRange(
                  comment.range,
                  newCommentText,
                );
              }
            }

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
        return;
      }

      context.report({
        node: nodeToComment,
        messageId: 'missingThrowsTag',
        fix(fixer) {
          const sortedThrowableTypes = toSortedByMetadata(throwableTypes);
          const sortedRejectableTypes = toSortedByMetadata(rejectableTypes);
          
          const indent = getNodeIndent(sourceCode, node);

          if (hasJSDoc(sourceCode, nodeToComment)) {
            const comments = sourceCode.getCommentsBefore(nodeToComment);
            const comment = comments
              .find(({ value }) => value.startsWith('*'));

            if (comment) {
              let newCommentText = sourceCode.getText(comment);
              const isOneLiner = !/^\/\*\*[ \t]*\n/.test(newCommentText);
              if (isOneLiner) {
                newCommentText = newCommentText
                  .replace(/^\/\*\*\s*/, `/**\n${indent} * `)
                  .replace(
                    /\s*\*\/$/,
                    sortedThrowableTypes.map((t) =>
                      `\n${indent} * @throws {${getQualifiedTypeName(checker, t)}}`
                    ).join('') +
                    '\n' +
                    sortedRejectableTypes.map((t) =>
                      `${indent} * @throws {Promise<${getQualifiedTypeName(checker, t)}>}`
                    ).join('\n') +
                    '\n' +
                    `${indent} */`
                  );
              } else {
                newCommentText = appendThrowsTags(
                  newCommentText,
                  [
                    ...sortedThrowableTypes.map((t) =>
                      getQualifiedTypeName(checker, t)
                    ),
                    ...sortedRejectableTypes.map((t) =>
                      `Promise<${getQualifiedTypeName(checker, t)}>`
                    ),
                  ],
                );
              }
              return fixer.replaceTextRange(
                comment.range,
                newCommentText,
              );
            }
          }

          return fixer
            .insertTextBefore(
              nodeToComment,
              `/**\n` +
              sortedThrowableTypes.map((t) =>
                `${indent} * @throws {${getQualifiedTypeName(checker, t)}}\n`
              ).join('') +
              sortedRejectableTypes.map((t) =>
                `${indent} * @throws {Promise<${getQualifiedTypeName(checker, t)}>}\n`
              ).join('') +
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

        const flattened = toFlattenedTypeArray(argumentTypes);

        rejectTypes.add(
          promiseReturningFunction,
          flattened
        );

        flattened
          .forEach(t => metadata.set(t, { pos: callbackNode.range[0] }));
      }

      if (throwStatementsInFunction.has(getNodeID(callbackNode))) {
        const throwStatementTypes = throwStatementsInFunction
          .get(getNodeID(callbackNode))
          ?.map(n => services.getTypeAtLocation(n.argument));

        if (throwStatementTypes) {
          const flattened = 
            toFlattenedTypeArray(throwStatementTypes);

          rejectTypes.add(
            promiseReturningFunction,
            flattened,
          );

          flattened
            .forEach(t => metadata.set(t, { pos: callbackNode.range[0] }));
        }
      }

      const callbackThrowsTagTypes = getJSDocThrowsTagTypes(
        checker,
        services.esTreeNodeToTSNodeMap.get(callbackNode)
      );

      if (callbackThrowsTagTypes.length) {
        const flattened =
          toFlattenedTypeArray(callbackThrowsTagTypes);

        rejectTypes.add(
          promiseReturningFunction,
          flattened,
        );

        flattened
          .forEach(t => metadata.set(t, { pos: callbackNode.range[0] }));
      }
    };

    return {
      /**
       * @description
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
      ':function NewExpression[callee.type="Identifier"]': visitFunctionCallNode,
      ':function CallExpression[callee.type="Identifier"]': visitFunctionCallNode,
      ':function MemberExpression[property.type="Identifier"]': visitFunctionCallNode,
      ':function AssignmentExpression[left.type="MemberExpression"]': visitFunctionCallNode,

      /**
       * Collect promise rejectable types
       */
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
       * Collect throwable types of generators
       */
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of MDN}
       */
      'ForOfStatement'(node) {
        const iterableType = services.getTypeAtLocation(node.right);
        if (!isGeneratorLike(iterableType)) return;

        visitIterableNode(node.right);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax MDN}
       */
      'SpreadElement'(node) {
        const iterableType = services.getTypeAtLocation(node.argument);
        if (!isGeneratorLike(iterableType)) return;

        visitIterableNode(node.argument);
      },
      /**
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from MDN}
       * @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node
       */
      'CallExpression:has(> MemberExpression[object.type="Identifier"][object.name="Array"][property.type="Identifier"][property.name="from"])'(node) {
        if (node.arguments.length < 1) return;

        const [firstArgumentNode] = node.arguments;
        const iterableType = services.getTypeAtLocation(firstArgumentNode);
        if (!isGeneratorLike(iterableType)) return;

        visitIterableNode(firstArgumentNode);
      },

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
