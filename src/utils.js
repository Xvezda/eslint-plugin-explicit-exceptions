// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');

// Object.groupBy clone
/**
 * Groups an array of objects by a specified key or function.
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
 * @template {unknown} T
 * @param {Readonly<T[]>} arr
 * @return {T | null}
 */
const getFirst = (arr) =>
  arr && arr.length
    ? arr[0]
    : null;

/**
 * @template {unknown} T
 * @param {Readonly<T[]>} arr
 * @return {T | null}
 */
const getLast = (arr) =>
  arr && arr.length
    ? arr[arr.length - 1]
    : null;

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/${name}.md`,
);

/** @param {string} comment */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {string}
 */
const getNodeID = (node) => {
  return `${node.loc.start.line}:${node.loc.start.column}`;
};

/**
 * Check if node has JSDoc comment with @throws or @exception tag.
 *
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {boolean}
 */
const hasJSDocThrowsTag = (sourceCode, node) => {
  const comments = sourceCode.getCommentsBefore(node);
  const isCommented =
    comments.length &&
    comments
      .map(({ value }) => value)
      .some(hasThrowsTag);

  return Boolean(isCommented);
};

/**
 * Combine multiple types into union type string of given types.
 *
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Type[]} types
 * @return {string}
 */
const typesToUnionString = (checker, types) =>
  [...new Set(types.map(t => utils.getTypeName(checker, t)))].join(' | ');

/**
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
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} [untilPredicate]
 * @returns {import('@typescript-eslint/utils').TSESTree.Node[]}
 */
const collectPaths = (node, untilPredicate) => {
  const path = [];
  while (node) {
    path.push(node);

    if (untilPredicate && untilPredicate(node)) {
      break;
    }
    node = node.parent;
  }
  return path.reverse();
};

/**
 * @template {string} T
 * @template {readonly unknown[]} U
 * @param {import('@typescript-eslint/utils').TSESLint.RuleContext<T, U>} context
 * @returns {{ [K in keyof U[number]]: U[number][K] }}
 */
const getOptionsFromContext = (context) => {
  const options =
    /** @type {{ [K in keyof U[number]]: U[number][K] }} */
    (Object.assign(Object.create(null), ...context.options));

  return options;
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
    .valueDeclaration;

/**
 * @param {import('typescript').Node} node
 * @returns {Readonly<import('typescript').JSDocThrowsTag[]>}
 */
const getJSDocThrowsTags = (node) =>
  /** @type {Readonly<import('typescript').JSDocThrowsTag[]>} */
  (ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocThrowsTag));

/**
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
 * @param {import('typescript').Type[]} types
 * @returns {import('typescript').Type[]}
 */
const toFlattenedTypeArray = (types) =>
  types.flatMap(type => type.isUnion() ? type.types : type);

/**
 * @param {import('@typescript-eslint/utils').ParserServicesWithTypeInformation['program']} program
 * @param {import('typescript').Type[]} source
 * @param {import('typescript').Type[]} target
 * @returns {{ compatible?: import('typescript').Type[]; incompatible?: import('typescript').Type[] }}
 */
const groupTypesByCompatibility = (program, source, target) => {
  const checker = program.getTypeChecker();

  return groupBy(source, sourceType => {
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
  })
}

/**
 * Find closest function where exception is thrown
 *
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('@typescript-eslint/utils').TSESTree.FunctionLike | null}
 */
const findClosestFunctionNode = (node) => {
  return /** @type {import('@typescript-eslint/utils').TSESTree.FunctionLike | null} */(
    findParent(node, (n) =>
      n.type === AST_NODE_TYPES.FunctionDeclaration ||
      n.type === AST_NODE_TYPES.FunctionExpression ||
      n.type === AST_NODE_TYPES.ArrowFunctionExpression
    )
  );
};

/**
 * Find where JSDoc comment should be added
 *
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
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression:
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
    default:
      break;
  }
  return null;
};

/**
 * Find declaration node of identifier node
 *
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
 * Check if node is in try-catch block where exception is handled
 *
 * @param {import('@typescript-eslint/utils').TSESTree.Node | undefined} node
 * @returns {boolean}
 */
const isInHandledContext = (node) => {
  while (node) {
    const paths = collectPaths(node, (n) =>
      n.type === AST_NODE_TYPES.TryStatement &&
      n.handler !== null
    );
    if (paths.length < 2) return false;

    /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
    const tryNode = 
      /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
      (paths[0]);

    if (
      tryNode.block &&
      tryNode.block.range[0] === paths[1].range[0]
    ) return true;

    node = node.parent;
  }
  return false;
};

/**
 * Create fixer to insert JSDoc comment before node
 * @param {Readonly<import('@typescript-eslint/utils').TSESLint.SourceCode>} sourceCode
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @param {string} typeString
 */
const createInsertJSDocBeforeFixer = (sourceCode, node, typeString) => {
  /** @param {import('@typescript-eslint/utils').TSESLint.RuleFixer} fixer */
  return (fixer) => {
    const lines = sourceCode.getLines();
    const currentLine = lines[node.loc.start.line - 1];
    const indent = currentLine.match(/^\s*/)?.[0] ?? '';

    return fixer
      .insertTextBefore(
        node,
        `/**\n` +
        `${indent} * @throws {${typeString}}\n` +
        `${indent} */\n` +
        `${indent}`
      );
  };
}

module.exports = {
  getFirst,
  getLast,
  getNodeID,
  createRule,
  hasThrowsTag,
  hasJSDocThrowsTag,
  typesToUnionString,
  findClosest,
  findParent,
  getOptionsFromContext,
  getDeclarationTSNodeOfESTreeNode,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  groupTypesByCompatibility,
  findClosestFunctionNode,
  findNodeToComment,
  findIdentifierDeclaration,
  isInHandledContext,
  createInsertJSDocBeforeFixer,
};
