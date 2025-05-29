// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/${name}.md`,
);

/**
 * Collects types for each node.
 * @public
 */
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

/**
 * @public
 * @template {unknown} T
 * @param {Readonly<T[]>} arr
 * @return {T | null}
 */
const getFirst = (arr) =>
  arr && arr.length
    ? arr[0]
    : null;

/**
 * @public
 * @template {unknown} T
 * @param {Readonly<T[]>} arr
 * @return {T | null}
 */
const getLast = (arr) =>
  arr && arr.length
    ? arr[arr.length - 1]
    : null;

/**
 * @public
 * @param {string} comment
 */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

/**
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {string}
 */
const getNodeID = (node) => {
  return `${node.loc.start.line}:${node.loc.start.column}`;
};

/**
 * Check if node has JSDoc comment with @throws or @exception tag.
 *
 * @public
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {boolean}
 */
const hasJSDocThrowsTag = (sourceCode, node) => {
  const comments = sourceCode.getCommentsBefore(node);
  const isCommented =
    !!comments.length &&
    comments
      .map(({ value }) => value)
      .some(hasThrowsTag);

  return isCommented;
};

/**
 * Combine multiple types into union type string of given types.
 *
 * @public
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Type[]} types
 * @return {string}
 */
const typesToUnionString = (checker, types) =>
  [...new Set(types.map(t => utils.getTypeName(checker, t)))].join(' | ');

/**
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} callback
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findClosest = (node, callback) => {
  if (!node) return null;

  do {
    if (callback(node)) {
      return node;
    }
  } while ((node = node?.parent));

  return null;
};

/**
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} callback
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findParent = (node, callback) => {
  while ((node = node?.parent)) {
    if (callback(node)) {
      return node;
    }
  }
  return null;
};

/**
 * Collects path from node to the root node until the predicate returns true.
 * If the predicate is not provided, it collects the entire path to the root.
 *
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} [untilPredicate]
 * @returns {import('@typescript-eslint/utils').TSESTree.Node[]}
 */
const collectPaths = (node, untilPredicate) => {
  const paths = [];
  while (node) {
    paths.push(node);

    if (untilPredicate && untilPredicate(node)) {
      break;
    }
    node = node.parent;
  }
  return paths.reverse();
};

/**
 * @private
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
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const getCallee = (node) => {
  switch (node.type) {
    case AST_NODE_TYPES.AssignmentExpression:
      return node.left;
    case AST_NODE_TYPES.CallExpression:
      return node.callee;
    case AST_NODE_TYPES.MemberExpression:
      return node.property;
    case AST_NODE_TYPES.Identifier:
      return getCallee(node.parent);
    default:
      break;
  }
  return null;
};

/**
 * @public
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.Expression} node
 * @return {import('typescript').Node | null}
 */
const getCalleeDeclaration = (services, node) => {
  /** @type {import('@typescript-eslint/utils').TSESTree.Node | null} */
  const calleeNode = getCallee(node);
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

          return isAccessorNode(declarationNode) &&
            declarationNode.kind === 'set';
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

          return isAccessorNode(declarationNode) &&
            declarationNode.kind === 'get';
        });

      if (getter) {
        return getter;
      }
      // fallthrough
    }
    case AST_NODE_TYPES.CallExpression:
      return declarations[0];
  }
  return null;
};

/**
 * @public
 * @param {import('typescript').Node} node
 * @returns {Readonly<import('typescript').JSDocThrowsTag[]>}
 */
const getJSDocThrowsTags = (node) =>
  /** @type {Readonly<import('typescript').JSDocThrowsTag[]>} */
  (ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocThrowsTag));

/**
 * @public
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Node} node
 * @returns {import('typescript').Type[]}
 */
const getJSDocThrowsTagTypes = (checker, node) => {
  const throwsTags = getJSDocThrowsTags(node);
  const throwsTypeNodes = throwsTags
    .map(tag => tag.typeExpression?.type)
    .filter(tag => !!tag);

  return throwsTypeNodes
    .map(typeNode => checker.getTypeFromTypeNode(typeNode));
};

/**
 * Treats union types as separate types.
 *
 * @public
 * @param {import('typescript').Type[]} types
 * @returns {import('typescript').Type[]}
 */
const toFlattenedTypeArray = (types) =>
  types.flatMap(type => type.isUnion() ? type.types : type);

/**
 * Collect function call expression nodes for given identifier node.
 *
 * @public
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Identifier} node
 * @return {import('@typescript-eslint/utils').TSESTree.CallExpression[]}
 */
const findFunctionCallNodes = (sourceCode, node) => {
  const scope = sourceCode.getScope(node)
  if (!scope) return [];

  const references =
    scope.set.get(node.name)?.references;

  if (!references) return [];

  return references
    .filter(ref =>
      ref.identifier.parent.type === AST_NODE_TYPES.CallExpression)
      .map(ref =>
        /** @type {import('@typescript-eslint/utils').TSESTree.CallExpression} */
        (ref.identifier.parent)
      );
};

/**
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {node is import('@typescript-eslint/utils').TSESTree.FunctionDeclaration | import('@typescript-eslint/utils').TSESTree.FunctionExpression | import('@typescript-eslint/utils').TSESTree.FunctionLike}
 */
const isFunctionNode = (node) => {
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression
  );
};

/**
 * @public
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('typescript').Type} type
 * @returns {boolean}
 */
const isPromiseType = (services, type) => {
  return (
    utils.isPromiseLike(services.program, type) &&
    type.symbol.getName() === 'Promise'
  );
};

/**
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {node is import('@typescript-eslint/utils').TSESTree.MethodDefinition | import('@typescript-eslint/utils').TSESTree.Property}
 */
const isAccessorNode = (node) => {
  return (
    (node?.type === AST_NODE_TYPES.MethodDefinition ||
     node?.type === AST_NODE_TYPES.Property) &&
    (node.value.type === AST_NODE_TYPES.ArrowFunctionExpression ||
     node.value.type === AST_NODE_TYPES.FunctionExpression)
  );
};

/**
 * Find closest function where exception is thrown
 *
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('@typescript-eslint/utils').TSESTree.FunctionLike | null}
 */
const findClosestFunctionNode = (node) => {
  return /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */(
    isFunctionNode(node)
      ? node
      : findParent(node, isFunctionNode)
  );
};

/**
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
const isPromiseConstructorCallbackNode = (node) => {
  return (
    node.parent?.type === AST_NODE_TYPES.NewExpression &&
    node.parent.callee.type === AST_NODE_TYPES.Identifier &&
    node.parent.callee.name === 'Promise'
  );
};

/**
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
const isThenableCallbackNode = (node) => {
  return (
    node.parent?.type === AST_NODE_TYPES.CallExpression &&
    node.parent.callee.type === AST_NODE_TYPES.MemberExpression &&
    node.parent.callee.property.type === AST_NODE_TYPES.Identifier &&
    /^(then|finally)$/.test(node.parent.callee.property.name)
  );
};

/**
 * Find where JSDoc comment should be added
 *
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findNodeToComment = (node) => {
  switch (node.type) {
    /**
     * @example
     * ```
     * // here
     * function target() { ... }
     * ```
     */
    case AST_NODE_TYPES.FunctionDeclaration:
      return node;
    case AST_NODE_TYPES.Identifier:
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression: {
      // If the current function is inlined in Promise constructor
      // or argument of thenable method,
      // it makes sense to comment where promise is referenced to.
      // Not the inline function itself.
      if (
        isPromiseConstructorCallbackNode(node) ||
        isThenableCallbackNode(node)
      ) {
        const functionDeclaration = findClosestFunctionNode(node.parent);
        if (functionDeclaration) {
          return findNodeToComment(functionDeclaration);
        }
        // TODO: Fallback?
        return null;
      }
      return (
        /**
         * @example
         * ```
         * class Klass {
         *   // here
         *   target() { ... }
         * }
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.MethodDefinition) ??
        /**
         * @example
         * ```
         * class Klass {
         *   // here
         *   target = () => { ... }
         * }
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.PropertyDefinition) ??
        /**
         * @example
         * ```
         * const obj = {
         *   // here
         *   target: () => { ... },
         * };
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.Property) ??
        /**
         * @example
         * ```
         * // here
         * const target = () => { ... };
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.VariableDeclaration) ??
        /**
         * @example
         * ```
         * function factory() {
         *   // here
         *   return function target() { ... };
         * }
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.ReturnStatement)
      );
    }
    default:
      break;
  }
  return null;
};

/**
 * Find declaration node of identifier node
 *
 * @public
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Identifier} node
 * @return {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findIdentifierDeclaration = (sourceCode, node) => {
  /** @type {import('@typescript-eslint/utils').TSESLint.Scope.Definition[]} */
  let defs = [];

  /** @type {ReturnType<typeof sourceCode.getScope> | null} */
  let scope = sourceCode.getScope(node);
  do {
    const variable = scope.set.get(node.name);
    if (variable) {
      defs =
        /** @type {import('@typescript-eslint/utils').TSESLint.Scope.Definition[]} */
        (variable.defs);
      break;
    }
    scope = scope.upper;
  } while (scope);

  if (!defs.length) return null;

  const definition = defs
    .map(def => {
      if (
        def.node.type === AST_NODE_TYPES.VariableDeclarator &&
        def.node.init
      ) {
        switch (def.node.init.type) {
          case AST_NODE_TYPES.ArrowFunctionExpression:
          case AST_NODE_TYPES.FunctionExpression:
            return def.node.init;
          default:
            return null;
        }
      } else if (def.node.type === AST_NODE_TYPES.FunctionDeclaration) {
        return def.node;
      }
      return null;
    })
    .filter(def => !!def);

  if (!definition.length) return null;

  return definition[0];
};

/**
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @param {import('@typescript-eslint/utils').TSESTree.Node} other
 * @returns {boolean}
 */
const isParentOrAncestor = (node, other) => {
  if (!node || !other) return false;

  return collectPaths(node)
    .some(n => getNodeID(n) === getNodeID(other));
};

/**
 * Check if node is in try-catch block where exception is handled
 *
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @returns {boolean}
 */
const isInHandledContext = (node) => {
  for (; node; node = node?.parent) {
    const paths = collectPaths(node, (n) =>
      n.type === AST_NODE_TYPES.TryStatement &&
      n.handler !== null
    );
    if (paths.length < 2) continue;

    /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
    const tryNode = 
      /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
      (paths[0]);

    if (
      tryNode.block &&
      isParentOrAncestor(paths[1], tryNode.block)
    ) return true;
  }
  return false;
};

/**
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
const isCatchMethodCalled = (node) => {
  return (
    node.parent?.parent?.type === AST_NODE_TYPES.CallExpression &&
    node.parent?.type === AST_NODE_TYPES.MemberExpression &&
    node.parent.property.type === AST_NODE_TYPES.Identifier &&
    node.parent.property.name === 'catch'
  );
};

/**
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
const isAwaitCatchPattern = (node) => {
  return (
    node.type === AST_NODE_TYPES.AwaitExpression &&
    isParentOrAncestor(
      node, 
      /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
      (findParent(node, (parent) =>
        parent.type === AST_NODE_TYPES.TryStatement &&
        parent.handler !== null
      ))?.block
    )
  );
};

/**
 * Check if node promise rejection handled.
 * Such as `try .. await node .. catch` or `node.catch(...)`
 *
 * @public
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @returns {boolean}
 */
const isInAsyncHandledContext = (sourceCode, node) => {
  if (!node) return false;

  const rejectionHandled =
    !!findClosest(node, isCatchMethodCalled) ||
    sourceCode.getScope(node)
      ?.references
      .some(ref => isCatchMethodCalled(ref.identifier)) ||
    sourceCode.getScope(node)
      ?.references
      .some(ref =>
        findClosest(ref.identifier, isAwaitCatchPattern) ||
        ref.resolved?.references
          .some(r => findClosest(r.identifier, isAwaitCatchPattern))
      );

  return rejectionHandled;
};

module.exports = {
  TypeMap,
  getFirst,
  getLast,
  getNodeID,
  createRule,
  hasThrowsTag,
  hasJSDocThrowsTag,
  typesToUnionString,
  findClosest,
  findParent,
  getCallee,
  getCalleeDeclaration,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  findFunctionCallNodes,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  isInHandledContext,
  isInAsyncHandledContext,
  isPromiseType,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
};
