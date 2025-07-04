// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');

// https://typescript-eslint.io/developers/eslint-plugins/#rulecreator-usage
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
     * @private
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
    const items = this.get(node);
    items.push(...types);
    return items;
  }

  /**
   * @param {import('@typescript-eslint/utils').TSESTree.Node} node
   */
  get(node) {
    return this.map.get(getNodeID(node)) ?? [];
  }
}

/**
 * Get first element of array or null if empty.
 *
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
 * Get last element of array or null if empty.
 *
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
 * Check if comment string contains JSDoc throws tag.
 *
 * @public
 * @param {string} comment
 */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

/**
 * Get unique ID for node based on its location.
 *
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {string}
 */
const getNodeID = (node) => {
  return `${node.loc.start.line}:${node.loc.start.column}`;
};

/**
 * Get indentation of the node in source code.
 * 
 * @public
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {string}
 */
const getNodeIndent = (sourceCode, node) => {
  const lines = sourceCode.getLines();
  const currentLine = lines[node.loc.start.line - 1];
  const indent = currentLine.match(/^\s*/)?.[0] ?? '';

  return indent;
};

/**
 * @public
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

/**
 * Check if node has any valid JSDoc.
 *
 * @public
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {boolean}
 */
const hasJSDoc = (sourceCode, node) => {
  const comments = sourceCode.getCommentsBefore(node);
  if (!comments.length) return false;

  return comments.some(comment => comment.value.startsWith('*'));
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
 * @param {string[]} typeStrings
 * @return {string}
 */
const typeStringsToUnionString = (typeStrings) =>
  [...new Set(typeStrings)].join(' | ');

/**
 * Get qualified type name that preserves namespace information.
 *
 * @public
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Type} type
 * @param {object} [options]
 * @param {boolean} [options.useBaseTypeOfLiteral=false]
 * @return {string}
 */
const getQualifiedTypeName = (checker, type, options = {}) => {
  const { useBaseTypeOfLiteral = false } = options;

  // If useBaseTypeOfLiteral is true and this is a literal type, use the base type
  let targetType = type;
  if (useBaseTypeOfLiteral && type.isLiteral?.()) {
    targetType = checker.getBaseTypeOfLiteralType(type);
  }

  // Use TypeScript's typeToString with NodeBuilderFlags to preserve namespaces
  return checker.typeToString(
    targetType,
    undefined,
    ts.TypeFormatFlags.UseFullyQualifiedType |
    ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
    ts.TypeFormatFlags.UseStructuralFallback |
    ts.TypeFormatFlags.InTypeAlias
  );
};

/**
 * Combine multiple types into union type string of given types.
 *
 * @public
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Type[]} types
 * @param {object} [options]
 * @param {boolean} [options.useBaseTypeOfLiteral=false]
 * @return {string}
 */
const typesToUnionString = (checker, types, options) =>
  typeStringsToUnionString(types.map(t => getQualifiedTypeName(checker, t, options)))

/**
 * Find closest node that matches the callback predicate.
 *
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
 * Find parent node that matches the callback predicate.
 *
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
 * Get call expression node's signature.
 *
 * @public
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.CallExpression | import('@typescript-eslint/utils').TSESTree.NewExpression} node
 * @return {import('typescript').Signature | null}
 */
const getCallSignature = (services, node) => {
  const checker = services.program.getTypeChecker();

  const calleeTSNode = services.esTreeNodeToTSNodeMap.get(node);
  if (!calleeTSNode) return null;

  const signature = checker.getResolvedSignature(calleeTSNode);
  if (!signature) return null;

  return signature;
};

/**
 * Get call expression node's declaration type.
 *
 * @private
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.CallExpression | import('@typescript-eslint/utils').TSESTree.NewExpression} node
 * @return {import('typescript').Declaration | null}
 */
const getCallSignatureDeclaration = (services, node) => {
  const signature = getCallSignature(services, node);
  if (!signature || !signature.declaration) return null;

  return signature.declaration;
};

/**
 * Get callee node from given node's type.
 *
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const getCallee = (node) => {
  switch (node.type) {
    case AST_NODE_TYPES.NewExpression:
    case AST_NODE_TYPES.CallExpression:
      return node.callee;
    // Setter
    case AST_NODE_TYPES.AssignmentExpression:
      return node.left;
    // Getter
    case AST_NODE_TYPES.MemberExpression:
      return node.property;
    case AST_NODE_TYPES.Identifier:
      return getCallee(node.parent);
    default:
      return null;
  }
};

/**
 * Get all declaration nodes of the callee from the given node's type.
 *
 * @public
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} services
 * @param {import('@typescript-eslint/utils').TSESTree.Expression} node
 * @return {import('typescript').Declaration | null}
 */
const getCalleeDeclaration = (services, node) => {
  /**
   * Return type of setter when assigning
   *
   * @example
   * ```
   * foo.bar = 'baz';
   * //  ^ This can be a setter
   * ```
   */
  if (node.type === AST_NODE_TYPES.AssignmentExpression) {
    /** @type {import('@typescript-eslint/utils').TSESTree.Node | null} */
    const calleeNode = getCallee(node);
    if (!calleeNode) return null;

    const type = services.getTypeAtLocation(calleeNode);
    for (
      const declaration of
      type.symbol?.declarations ??
      services
        .getSymbolAtLocation(calleeNode)
        ?.declarations ??
      []
    ) {
      if (!services.tsNodeToESTreeNodeMap.has(declaration)) continue;

      const declarationNode =
        services.tsNodeToESTreeNodeMap.get(declaration);

      const isSetter = isAccessorNode(declarationNode) &&
        declarationNode.kind === 'set';

      if (isSetter) {
        return declaration;
      }
    }
    return null;
  }

  /** @type {import('typescript').Declaration | null} */
  let declaration = null;
  if (
    node.type === AST_NODE_TYPES.CallExpression ||
    node.type === AST_NODE_TYPES.NewExpression
  ) {
    declaration = getCallSignatureDeclaration(services, node);
  } else if (node.parent?.type === AST_NODE_TYPES.CallExpression) {
    declaration = getCallSignatureDeclaration(services, node.parent);
  } else {
    /** @type {import('@typescript-eslint/utils').TSESTree.Node | null} */
    const calleeNode = getCallee(node);
    if (!calleeNode) return null;

    const type = services.getTypeAtLocation(calleeNode);

    if (type.symbol?.valueDeclaration) {
      declaration = type.symbol.valueDeclaration;
    } else if (type.symbol?.declarations?.length) {
      // If there are multiple declarations, we take the first one.
      declaration = type.symbol.declarations[0];
    } else {
      const declarations = services
        .getSymbolAtLocation(calleeNode)
        ?.declarations;

      if (!declarations?.length) return null;

      // If there are multiple declarations, we take the first one.
      declaration = declarations[0];
    }
  }
  if (!declaration) return null;

  switch (node.type) {
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
      const declarationNode =
        services.tsNodeToESTreeNodeMap.get(declaration);

      const isGetter = isAccessorNode(declarationNode) &&
        declarationNode.kind === 'get';

      if (
        isGetter ||
        // It is method call
        node.parent?.type === AST_NODE_TYPES.CallExpression
      ) {
        return declaration;
      }
      return null;
    }
    case AST_NODE_TYPES.NewExpression:
    case AST_NODE_TYPES.CallExpression:
      return declaration;
    default:
      return null;
  }
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
 * Grab types from only typed throws tags.
 *
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

  const references = scope.set.get(node.name)?.references;

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
 * Check if type is exactly a Promise type.
 *
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
 * @public
 * @param {import('typescript').Type} type
 * @returns {boolean}
 */
const isGeneratorLike = (type) => {
  const members = type.symbol?.members;
  if (!members) return false;

  /**
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator#instance_methods MDN}
   */
  return (
    // @ts-expect-error - Not assignable to '__String'
    members.has('next') &&
    // @ts-expect-error - Not assignable to '__String'
    members.has('return') &&
    // @ts-expect-error - Not assignable to '__String'
    members.has('throw')
  );
};

/**
 * @public
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
 * Check if node is a callback function of Promise constructor.
 *
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
 * Check if node is a callback function of one of the promise chain thenable methods.
 *
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
 * @param {import('@typescript-eslint/utils').TSESTree.FunctionLike | import('@typescript-eslint/utils').TSESTree.Identifier} node
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findNodeToComment = (node) => {
  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      /**
       * Exported function declaration should be commented at export node,
       * not at the function declaration itself.
       *
       * @example
       * ```
       * // here
       * export default function target() { ... }
       * //             ^ not here
       * ```
       */
      if (
        node.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        node.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
      ) {
        return node.parent;
      }
      /**
       * @example
       * ```
       * // here
       * function target() { ... }
       * ```
       */
      return node;
    case AST_NODE_TYPES.Identifier:
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression: {
      /**
       * If the current function is inlined in Promise constructor
       * or argument of thenable method,
       * it makes sense to comment where promise is referenced to.
       * Not the inline function itself.
       *
       * @example
       * ```
       * // here
       * function example() {
       *   // not here
       *   return new Promise((resolve, reject) => { ... });
       *   //                 ^ node
       * }
       * ```
       */
      if (
        isPromiseConstructorCallbackNode(node) ||
        isThenableCallbackNode(node)
      ) {
        const functionDeclaration = findClosestFunctionNode(node.parent);
        if (functionDeclaration) {
          return findNodeToComment(functionDeclaration);
        }
        return null;
      }
      if (!isFunctionNode(node)) return null;

      return (
        /**
         * @example
         * ```
         * class Klass {
         *   // here
         *   target() { ... }
         *   //    ^ node
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
         *   //       ^ node
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
         *   //      ^ node
         * };
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.Property) ??
        /**
         * @example
         * ```
         * // here
         * export const target = () => { ... };
         * //                    ^ node
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.ExportNamedDeclaration) ??
        /**
         * @example
         * ```
         * // here
         * const target = () => { ... };
         * //             ^ node
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.VariableDeclaration) ??
        /**
         * @example
         * ```
         * function factory() {
         *   // here
         *   return function target() { ... };
         *   //     ^ node
         * }
         * ```
         */
        findParent(node, (n) => n.type === AST_NODE_TYPES.ReturnStatement)
      );
    }
    default:
      return null;
  }
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
  /** @param {import('@typescript-eslint/utils').TSESTree.Node} node */
  const isTryStatementWithCatch = (node) => {
    return (
      node.type === AST_NODE_TYPES.TryStatement &&
      node.handler !== null
    );
  };

  for (; node; node = node?.parent) {
    const paths = collectPaths(node, isTryStatementWithCatch);
    if (paths.length < 2) continue;

    /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
    const tryNode = 
      /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
      (paths[0]);

    const isCurrentNodeInTryBlock =
      tryNode.block &&
      isParentOrAncestor(paths[1], tryNode.block);

    if (isCurrentNodeInTryBlock) return true;
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
    (node.parent.property.name === 'catch' ||
      node.parent.property.name === 'then' &&
      node.parent.parent.arguments.length >= 2
    )
  );
};

/**
 * @private
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
const isAwaitCatchPattern = (node) => {
  return (
    (
      node.type === AST_NODE_TYPES.AwaitExpression ||
      // yield*
      findParent(node, (parent) =>
        parent.type === AST_NODE_TYPES.YieldExpression &&
        parent.delegate
      ) ||
      // for await
      isParentOrAncestor(
        node, 
        /** @type {import('@typescript-eslint/utils').TSESTree.ForOfStatement} */
        (findParent(node, (parent) =>
          parent.type === AST_NODE_TYPES.ForOfStatement &&
          parent.await
        ))?.right
      )
    ) &&
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

/**
 * @public
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
const isNodeReturned = (node) => {
  while (
    node.parent?.type === AST_NODE_TYPES.SequenceExpression &&
    node.parent.expressions
      .findIndex(expr => expr === node) === node.parent.expressions.length - 1
  ) {
    node = node.parent;
  }
  return (
    node.parent?.type === AST_NODE_TYPES.ReturnStatement ||
    node.parent?.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    node.parent?.body.type !== AST_NODE_TYPES.BlockStatement
  );
};

module.exports = {
  TypeMap,
  getFirst,
  getLast,
  getNodeID,
  getNodeIndent,
  createRule,
  appendThrowsTags,
  hasThrowsTag,
  hasJSDoc,
  hasJSDocThrowsTag,
  typeStringsToUnionString,
  typesToUnionString,
  getQualifiedTypeName,
  findClosest,
  findParent,
  getCallSignature,
  getCallSignatureDeclaration,
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
  isNodeReturned,
  isGeneratorLike,
  isPromiseType,
  isPromiseConstructorCallbackNode,
  isAccessorNode,
  isThenableCallbackNode,
};
