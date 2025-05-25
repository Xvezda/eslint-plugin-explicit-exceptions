const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const utils = require('@typescript-eslint/type-utils');
const ts = require('typescript');


const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/${name}.md`,
);

/** @param {string} comment */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

/**
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Type[]} types
 * @return {string}
 */
const typesToUnionString = (checker, types) =>
  types.map(t => utils.getTypeName(checker, t)).join(' | ');

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} callback
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findClosest = (node, callback) => {
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
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
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
 * @return {import('typescript').Declaration[] | undefined}
 */
const getDeclarationsByNode = (services, node) => {
  return services
    .getSymbolAtLocation(node)
    ?.declarations;
};

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @return {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const getCalleeFromExpression = (node) => {
  switch (node.type) {
    case AST_NODE_TYPES.MemberExpression:
      return node.property;
    case AST_NODE_TYPES.CallExpression:
      return node.callee;
    case AST_NODE_TYPES.AssignmentExpression:
      return node.left;
    default:
      break;
  }
  return null;
};

/**
 * @param {import('@typescript-eslint/utils').ParserServices} services
 * @param {import('@typescript-eslint/utils').TSESTree.ExpressionStatement} node
 * @return {import('typescript').Node | null}
 */
const getCalleeDeclaration = (services, node) => {
  const calleeNode = getCalleeFromExpression(node);
  const declarations = getDeclarationsByNode(services, calleeNode);

  if (!declarations || !declarations.length) {
    return null;
  }

  switch (node.type) {
    case AST_NODE_TYPES.AssignmentExpression:
      const setter = declarations
        .find(declaration =>
          services.tsNodeToESTreeNodeMap
            .get(declaration).kind === 'set'
        );
      console.log('setter', setter);
      return setter ?? declarations[0];
    case AST_NODE_TYPES.MemberExpression:
      const getter = declarations
        .find(declaration =>
          services.tsNodeToESTreeNodeMap
            .get(declaration)?.kind === 'get'
        );
      if (getter) {
        return getter;
      }
    case AST_NODE_TYPES.CallExpression:
      return declarations[0];
  }
  return null;
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
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').Type[]} source
 * @param {import('typescript').Type[]} target
 * @returns {boolean}
 */
const isTypesAssignableTo = (checker, source, target) =>
  source
    .every(sourceType =>
      target
        .some(targetType => checker.isTypeAssignableTo(sourceType, targetType))
    );

/**
 * Find closest function where exception is thrown
 *
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findClosestFunctionNode = (node) => {
  return findParent(node, (n) =>
    n.type === AST_NODE_TYPES.FunctionDeclaration ||
    n.type === AST_NODE_TYPES.FunctionExpression ||
    n.type === AST_NODE_TYPES.ArrowFunctionExpression
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
 * Check if node is in try-catch block where exception is handled
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * returns {boolean}
 */
const isInHandledContext = (node) => {
  while (node) {
    const paths = collectPaths(node, (n) =>
      n.type === AST_NODE_TYPES.TryStatement &&
      n.handler !== null
    );
    if (paths.length < 2) return false;

    /** @type {import('@typescript-eslint/utils').TSESTree.TryStatement} */
    const tryNode = paths[0];

    if (
      tryNode.block &&
      tryNode.block.range[0] === paths[1].range[0]
    ) return true;

    node = node.parent;
  }
  return false;
};

module.exports = {
  createRule,
  hasThrowsTag,
  typesToUnionString,
  findClosest,
  findParent,
  getOptionsFromContext,
  getCalleeDeclaration,
  getDeclarationTSNodeOfESTreeNode,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  isTypesAssignableTo,
  findClosestFunctionNode,
  findNodeToComment,
  isInHandledContext,
};
