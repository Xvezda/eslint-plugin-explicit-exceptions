// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const {
  getLast,
  getNodeID,
  createRule,
  isInHandledContext,
  typesToUnionString,
  hasJSDocThrowsTag,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  getDeclarationTSNodeOfESTreeNode,
  toFlattenedTypeArray,
  groupTypesByCompatibility,
  findClosestFunctionNode,
  findNodeToComment,
  createInsertJSDocBeforeFixer,
} = require('../utils');

/**
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {import('typescript').Declaration[] | undefined}
 */
const getDeclarationsByNode = (services, node) => {
  return services
    .getSymbolAtLocation(node)
    ?.declarations;
};

/**
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.Expression} node
 * @return {import('typescript').Node | null}
 */
const getCalleeDeclaration = (services, node) => {
  /** @type {import('@typescript-eslint/utils').TSESTree.Node | null} */
  let calleeNode = null;
  switch (node.type) {
    case AST_NODE_TYPES.MemberExpression:
      calleeNode = node.property;
      break;
    case AST_NODE_TYPES.CallExpression:
      calleeNode = node.callee;
      break;
    case AST_NODE_TYPES.AssignmentExpression:
      calleeNode = node.left;
      break;
    default:
      break;
  }
  if (!calleeNode) return null;

  const declarations = getDeclarationsByNode(services, calleeNode);
  if (!declarations || !declarations.length) {
    return null;
  }

  switch (node.type) {
    /**
     * Return type of setter when assigning
     *
     * @example
     * ```
     * foo.bar = 'baz';
     * //  ^ This can be a setter
     * ```
     */
    case AST_NODE_TYPES.AssignmentExpression: {
      const setter = declarations
        .find(declaration => {
          const declarationNode =
            services.tsNodeToESTreeNodeMap.get(declaration);

          if (
            declarationNode?.type === AST_NODE_TYPES.MethodDefinition ||
            declarationNode?.type === AST_NODE_TYPES.Property
          ) {
            return declarationNode.value.type === AST_NODE_TYPES.ArrowFunctionExpression ||
              declarationNode.value.type === AST_NODE_TYPES.FunctionExpression &&
              declarationNode.kind === 'set';
          }
          return false;
        });
      return setter ?? declarations[0];
    }
    /**
     * Return type of getter when accessing
     *
     * @example
     * ```
     * const baz = foo.bar;
     * //              ^ This can be a getter
     * ```
     */
    case AST_NODE_TYPES.MemberExpression: {
      const getter = declarations
        .find(declaration => {
          const declarationNode =
            services.tsNodeToESTreeNodeMap.get(declaration);

          if (
            declarationNode?.type === AST_NODE_TYPES.MethodDefinition ||
            declarationNode?.type === AST_NODE_TYPES.Property
          ) {
            return declarationNode.value.type === AST_NODE_TYPES.ArrowFunctionExpression ||
              declarationNode.value.type === AST_NODE_TYPES.FunctionExpression &&
              declarationNode.kind === 'get';
          }
          return false;
        });

      if (getter) {
        return getter;
      }
    }
    case AST_NODE_TYPES.CallExpression:
      return declarations[0];
  }
  return null;
};


module.exports = createRule({
  name: 'no-implicit-propagation',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not allows implicit propagation of exceptions',
    },
    fixable: 'code',
    messages: {
      implicitPropagation:
        'Implicit propagation of exceptions is not allowed. Add JSDoc comment with @throws (or @exception) tag.',
      throwTypeMismatch:
        'The type of the exception thrown does not match the type specified in the @throws (or @exception) tag.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    const visitedNodes = new Set();

    /**
     * Group callee throws types by caller declaration.
     * @type {Map<string, import('typescript').Type[]>}
     */
    const calleeThrowsTypesGroup = new Map();

    /** @param {import('@typescript-eslint/utils').TSESTree.Expression} node */
    const visitExpression = (node) => {
      if (visitedNodes.has(getNodeID(node))) return;
      visitedNodes.add(getNodeID(node));

      if (isInHandledContext(node)) return;

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const calleeDeclaration = getCalleeDeclaration(services, node);
      if (!calleeDeclaration) return;

      const calleeThrowsTypes = getJSDocThrowsTagTypes(checker, calleeDeclaration);
      if (!calleeThrowsTypes.length) return;

      const key = getNodeID(callerDeclaration);
      if (!calleeThrowsTypesGroup.has(key)) {
        calleeThrowsTypesGroup.set(key, []);
      }
      calleeThrowsTypesGroup.get(key)?.push(...calleeThrowsTypes);
    };

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const exitFunction = (node) => {
      if (isInHandledContext(node)) return;

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const nodeToComment = findNodeToComment(callerDeclaration);
      if (!nodeToComment) return;

      const key = getNodeID(callerDeclaration);
      if (!calleeThrowsTypesGroup.has(key)) return;

      const calleeThrowsTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
            calleeThrowsTypesGroup.get(key)
              ?.map(t => checker.getAwaitedType(t) ?? t))
        );

      if (!calleeThrowsTypes) return;

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) {
        const callerDeclarationTSNode =
          getDeclarationTSNodeOfESTreeNode(services, callerDeclaration);

        if (!callerDeclarationTSNode) return;

        const callerThrowsTags = getJSDocThrowsTags(callerDeclarationTSNode);
        const callerThrowsTypeNodes =
          callerThrowsTags
            .map(tag => tag.typeExpression?.type)
            .filter(tag => !!tag);

        if (!callerThrowsTypeNodes.length) return;

        const callerThrowsTypes =
          toFlattenedTypeArray(
            getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
              .map(t => checker.getAwaitedType(t) ?? t)
          );

        const typeGroups = groupTypesByCompatibility(
          services.program,
          calleeThrowsTypes,
          callerThrowsTypes,
        );

        const lastThrowsTypeNode = getLast(callerThrowsTypeNodes);
        if (!lastThrowsTypeNode) return;

        const callerFixedType = typesToUnionString(
          checker,
          [
            ...typeGroups.target.compatible ?? [],
            ...typeGroups.source.incompatible ?? [],
          ]
        );

        // All thrown types must be promise if it's called in async function
        if (
          node.async &&
          !getJSDocThrowsTagTypes(checker, callerDeclarationTSNode)
            .every(t =>
              utils.isPromiseLike(services.program, t) &&
              t.symbol.getName() === 'Promise'
            )
        ) {
          context.report({
            node,
            messageId: 'throwTypeMismatch',
            fix(fixer) {
              return fixer.replaceTextRange(
                [lastThrowsTypeNode.pos, lastThrowsTypeNode.end],
                `Promise<${callerFixedType}>`,
              );
            },
          });
          return;
        }

        // If all callee thrown types are compatible with caller's throws tags,
        // we don't need to report anything
        if (!typeGroups.source.incompatible) return;

        const lastThrowsTag = getLast(callerThrowsTags);
        if (!lastThrowsTag) return;

        if (callerThrowsTags.length > 1) {
          const callerJSDocTSNode = lastThrowsTag.parent;
          /**
           * @param {string} jsdocString
           * @param {import('typescript').Type[]} types
           * @returns {string}
           */
          const appendThrowsTags = (jsdocString, types) =>
            types.reduce((acc, t) =>
              acc.replace(
                /([^*\n]+)(\*+[/])/,
                `$1* @throws {${utils.getTypeName(checker, t)}}\n$1$2`
              ),
              jsdocString
            );

          const mismatchedCalleeThrowsTypes = typeGroups.source.incompatible;
          if (!mismatchedCalleeThrowsTypes) return;

          context.report({
            node,
            messageId: 'throwTypeMismatch',
            fix(fixer) {
              return fixer.replaceTextRange(
                [callerJSDocTSNode.getStart(), callerJSDocTSNode.getEnd()],
                appendThrowsTags(
                  callerJSDocTSNode.getFullText(),
                  mismatchedCalleeThrowsTypes,
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
            // If there is only one throws tag, make it as a union type
            return fixer.replaceTextRange(
              [lastThrowsTypeNode.pos, lastThrowsTypeNode.end],
              node.async
                ? `Promise<${callerFixedType}>`
                : callerFixedType
            );
          },
        });
        return;
      }

      context.report({
        node,
        messageId: 'implicitPropagation',
        fix: createInsertJSDocBeforeFixer(
          sourceCode,
          nodeToComment,
          node.async
            ? `Promise<${typesToUnionString(checker, calleeThrowsTypes)}>`
            : typesToUnionString(checker, calleeThrowsTypes)
        ),
      });
    };

    return {
      'ArrowFunctionExpression MemberExpression[property.type="Identifier"]': visitExpression,
      'FunctionDeclaration MemberExpression[property.type="Identifier"]': visitExpression,
      'FunctionExpression MemberExpression[property.type="Identifier"]': visitExpression,
      'ArrowFunctionExpression CallExpression[callee.type="Identifier"]': visitExpression,
      'FunctionDeclaration CallExpression[callee.type="Identifier"]': visitExpression,
      'FunctionExpression CallExpression[callee.type="Identifier"]': visitExpression,
      'ArrowFunctionExpression AssignmentExpression[left.type="MemberExpression"]': visitExpression,
      'FunctionDeclaration AssignmentExpression[left.type="MemberExpression"]': visitExpression,
      'FunctionExpression AssignmentExpression[left.type="MemberExpression"]': visitExpression,

      'ArrowFunctionExpression:exit': exitFunction,
      'FunctionDeclaration:exit': exitFunction,
      'FunctionExpression:exit': exitFunction,
    };
  },
  defaultOptions: [],
});
