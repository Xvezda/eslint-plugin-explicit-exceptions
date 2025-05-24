const { ESLintUtils } = require('@typescript-eslint/utils');
const ts = require('typescript');

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/${name}.md`,
);

/** @param {string} comment */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 * @param {function(import('@typescript-eslint/utils').TSESTree.Node): boolean} callback
 * @returns {import('@typescript-eslint/utils').TSESTree.Node | null}
 */
const findParent = (node, callback) => {
  do {
    if (!node.parent) return null;

    node = node.parent;

    if (callback(node)) {
      return node;
    }
  } while (node);

  return null;
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
const getDeclarationTSNodeOfESTreeNode = (services, node) => {
  return services
    .getTypeAtLocation(node)
    .symbol
    .valueDeclaration;
};

/**
 * @param {import('typescript').Node} node
 * @returns {Readonly<import('typescript').JSDocThrowsTag[]>}
 */
const getJSDocThrowsTags = (node) => {
  return /** @type {Readonly<import('typescript').JSDocThrowsTag[]>} */(
    ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocThrowsTag)
  );
};

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
const isTypesAssignableTo = (checker, source, target) => {
  return source.every(sourceType =>
    target.some(targetType => checker.isTypeAssignableTo(sourceType, targetType))
  );
};

module.exports = {
  createRule,
  hasThrowsTag,
  findParent,
  getOptionsFromContext,
  getDeclarationTSNodeOfESTreeNode,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  isTypesAssignableTo,
};
