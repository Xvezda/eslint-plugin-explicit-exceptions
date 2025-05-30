// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const {
  TypeMap,
  getNodeID,
  getNodeIndent,
  createRule,
  isInHandledContext,
  typesToUnionString,
  hasJSDocThrowsTag,
  getJSDocThrowsTagTypes,
  getCalleeDeclaration,
  toFlattenedTypeArray,
  findClosestFunctionNode,
  findNodeToComment,
} = require('../utils');


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
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    /**
     * Group throw statements in functions
     * Using function as a key
     * @type {Map<string, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatementsInFunction = new Map();

    /** @type {Set<string>} */
    const visitedExpressionNodes = new Set();

    /**
     * Group callee throws types by caller declaration.
     */
    const calleeThrowsTypesMap = new TypeMap();

    /** @param {import('@typescript-eslint/utils').TSESTree.Expression} node */
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

      calleeThrowsTypesMap.add(callerDeclaration, calleeThrowsTypes);
    };

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitFunctionOnExit = (node) => {
      if (isInHandledContext(node)) return;

      const callerDeclaration = findClosestFunctionNode(node);
      if (!callerDeclaration) return;

      const nodeToComment = findNodeToComment(callerDeclaration);
      if (!nodeToComment) return;

      if (!calleeThrowsTypesMap.get(callerDeclaration).length) return;

      const calleeThrowsTypes =
        toFlattenedTypeArray(
          /** @type {import('typescript').Type[]} */(
            calleeThrowsTypesMap.get(callerDeclaration)
              ?.map(t => checker.getAwaitedType(t) ?? t))
        );

      if (!calleeThrowsTypes.length) return;

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      const throwTypeString = typesToUnionString(checker, calleeThrowsTypes);

      context.report({
        node,
        messageId: 'implicitPropagation',
        fix(fixer) {
          const indent = getNodeIndent(sourceCode, nodeToComment);

          return fixer
            .insertTextBefore(
              nodeToComment,
              `/**\n` +
              `${indent} * @throws {${
                node.async
                  ? `Promise<${throwTypeString}>`
                  : throwTypeString
              }}\n` +
              `${indent} */\n` +
              `${indent}`
            );
        }
      });
    };

    return {
      /**
       * Collect and group throw statements in functions
       */
      ThrowStatement(node) {
        if (isInHandledContext(node)) return; 

        const functionDeclaration = findClosestFunctionNode(node);
        if (!functionDeclaration) return;

        if (!throwStatementsInFunction.has(getNodeID(functionDeclaration))) {
          throwStatementsInFunction.set(getNodeID(functionDeclaration), []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatementsInFunction.get(getNodeID(functionDeclaration)));

        throwStatementNodes.push(node);
      },
      ':function MemberExpression[property.type="Identifier"]': visitFunctionCallNode,
      ':function CallExpression[callee.type="Identifier"]': visitFunctionCallNode,
      ':function AssignmentExpression[left.type="MemberExpression"]': visitFunctionCallNode,

      ':function:exit': visitFunctionOnExit,
    };
  },
  defaultOptions: [],
});
