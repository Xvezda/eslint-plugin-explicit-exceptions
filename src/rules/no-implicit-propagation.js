// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');
const {
  getNodeID,
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
     * @type {Map<string, import('@typescript-eslint/utils').TSESTree.ThrowStatement[]>}
     */
    const throwStatements = new Map();

    /** @type {Set<string>} */
    const visitedExpressionNodes = new Set();

    /**
     * Group callee throws types by caller declaration.
     * @type {Map<string, import('typescript').Type[]>}
     */
    const calleeThrowsTypesGroup = new Map();

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

      const key = getNodeID(callerDeclaration);
      if (!calleeThrowsTypesGroup.has(key)) {
        calleeThrowsTypesGroup.set(key, []);
      }
      calleeThrowsTypesGroup.get(key)?.push(...calleeThrowsTypes);
    };

    /** @param {import('@typescript-eslint/utils').TSESTree.FunctionLike} node */
    const visitFunctionOnExit = (node) => {
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

      if (hasJSDocThrowsTag(sourceCode, nodeToComment)) return;

      const throwTypeString = typesToUnionString(checker, calleeThrowsTypes);

      context.report({
        node,
        messageId: 'implicitPropagation',
        fix(fixer) {
          const lines = sourceCode.getLines();
          const currentLine = lines[nodeToComment.loc.start.line - 1];
          const indent = currentLine.match(/^\s*/)?.[0] ?? '';

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

        if (!throwStatements.has(getNodeID(functionDeclaration))) {
          throwStatements.set(getNodeID(functionDeclaration), []);
        }
        const throwStatementNodes =
          /** @type {import('@typescript-eslint/utils').TSESTree.ThrowStatement[]} */
          (throwStatements.get(getNodeID(functionDeclaration)));

        throwStatementNodes.push(node);
      },
      'ArrowFunctionExpression MemberExpression[property.type="Identifier"]': visitFunctionCallNode,
      'FunctionDeclaration MemberExpression[property.type="Identifier"]': visitFunctionCallNode,
      'FunctionExpression MemberExpression[property.type="Identifier"]': visitFunctionCallNode,
      'ArrowFunctionExpression CallExpression[callee.type="Identifier"]': visitFunctionCallNode,
      'FunctionDeclaration CallExpression[callee.type="Identifier"]': visitFunctionCallNode,
      'FunctionExpression CallExpression[callee.type="Identifier"]': visitFunctionCallNode,
      'ArrowFunctionExpression AssignmentExpression[left.type="MemberExpression"]': visitFunctionCallNode,
      'FunctionDeclaration AssignmentExpression[left.type="MemberExpression"]': visitFunctionCallNode,
      'FunctionExpression AssignmentExpression[left.type="MemberExpression"]': visitFunctionCallNode,

      'ArrowFunctionExpression:exit': visitFunctionOnExit,
      'FunctionDeclaration:exit': visitFunctionOnExit,
      'FunctionExpression:exit': visitFunctionOnExit,
    };
  },
  defaultOptions: [],
});
