// @ts-check
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
const { test, describe } = require('node:test');
const { strict: assert } = require('node:assert');

const { TSESLint, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const { simpleTraverse } = require('@typescript-eslint/typescript-estree');
const { parseForESLint, createProgram } = require('@typescript-eslint/parser');

const {
  TypeMap,
  getFirst,
  getLast,
  getNodeID,
  getNodeIndent,
  hasThrowsTag,
  hasJSDocThrowsTag,
  typeStringsToUnionString,
  typesToUnionString,
  findClosest,
  findParent,
  getCallSignatureDeclaration,
  getCallee,
  getCalleeDeclaration,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  findFunctionCallNodes,
  isGeneratorLike,
  isPromiseType,
  isAccessorNode,
  findClosestFunctionNode,
  isPromiseConstructorCallbackNode,
  isThenableCallbackNode,
  findNodeToComment,
  findIdentifierDeclaration,
  isInHandledContext,
  isInAsyncHandledContext,
  isNodeReturned,
} = require('../src/utils');

describe('utils', () => {
  test('TypeMap', () => {
    const { ast, services } = parse(`
function foo() {
  const a: number = 42;
  const b: string = 'foo';
}
    `);
    const ids = new Map();
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          ids.set(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node).name,
            node
          );
        },
      },
    }, true);

    const foo = ids.get('foo');
    const a = ids.get('a');
    const b = ids.get('b');
    const aType = services.getTypeAtLocation(a);
    const bType = services.getTypeAtLocation(b);

    const typeMap = new TypeMap();

    assert.deepEqual([], typeMap.get(foo));

    typeMap.add(foo, [aType]);

    assert.deepEqual([aType], typeMap.get(foo));

    typeMap.add(foo, [bType]);

    assert.deepEqual([aType, bType], typeMap.get(foo));
  });

  test('getFirst', () => {
    assert.equal(getFirst([]), null);
    assert.equal(getFirst([42]), 42);
    assert.equal(getFirst(['foo', 'bar']), 'foo');
  });

  test('getLast', () => {
    assert.equal(getLast([]), null);
    assert.equal(getLast([42]), 42);
    assert.equal(getLast(['foo', 'bar']), 'bar');
  });

  test('getNodeIndent', () => {
    const { ast, sourceCode } = parse(`
function foo() {
  const bar: string = 'baz';
}
    `);

    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node).name === 'bar'
          ) {
            const indent = getNodeIndent(sourceCode, node);
            assert.equal(indent.length, 2);
          }
        },
      },
    }, true);
  });

  test('getNodeID', () => {
    const { ast } = parse(`
function foo() {}
function foo() {
  const foo = 42;
  function foo() {}
}
    `);

    const ids = new Set();
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          ids.add(getNodeID(node));
        }
      },
    }, true);

    assert.equal(ids.size, 4);
  });

  test('hasThrowsTag', () => {
    const { ast, sourceCode } = parse(`
function foo() {
  throw new Error();
}

/**
 * @throws {Error}
 */
function bar() {
  throw new Error();
}
    `);

    /** @param {import('@typescript-eslint/utils').TSESTree.Comment[]} comments */
    const commentsToString = (comments) => {
      return comments
        .map((c) => c.value.trim())
        .join('\n');
    };

    /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration[]} */
    const functionNodes = [];
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          functionNodes.push(
            /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
            (node)
          );
        },
      },
    }, true);

    assert.equal(functionNodes.length, 2);

    const foo = functionNodes.find((node) => node.id?.name === 'foo');

    assert(foo);
    assert.equal(
      hasThrowsTag(commentsToString(sourceCode.getCommentsBefore(foo))),
      false,
    );
    
    const bar = functionNodes.find((node) => node.id?.name === 'bar');

    assert(bar);
    assert.equal(
      hasThrowsTag(commentsToString(sourceCode.getCommentsBefore(bar))),
      true,
    );
  });

  test('hasJSDocThrowsTag', () => {
    const { ast, sourceCode } = parse(`
function foo() {
  throw new Error();
}

/**
 * @throws {Error}
 */
function bar() {
  throw new Error();
}
    `);

    /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration[]} */
    const functionNodes = [];
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          functionNodes.push(
            /** @type {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} */
            (node)
          );
        },
      },
    }, true);

    const foo = functionNodes.find((node) =>
      node.id?.name === 'foo'
    );
    assert(foo);
    assert.equal(hasJSDocThrowsTag(sourceCode, foo), false);
    
    const bar = functionNodes.find((node) => node.id?.name === 'bar');
    assert(bar);
    assert.equal(hasJSDocThrowsTag(sourceCode, bar), true);
  });

  test('typeStringsToUnionString', () => {
    assert.equal(typeStringsToUnionString(['string']), 'string');
    assert.equal(typeStringsToUnionString(['string', 'number']), 'string | number');
  });

  test('typesToUnionString', () => {
    const { ast, services } = parse(`
const a: number = 42;
const b: string = 'foo';
const c: string = 'bar';
const d: number = 123;
const e: string = 'baz';
const f: number = 456;
    `);

    const checker = services.program.getTypeChecker();

    /** @type {import('typescript').Type[]} */
    const types = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          types.push(services.getTypeAtLocation(node));
        },
      },
    }, true);

    assert.equal(
      typesToUnionString(checker, types),
      'number | string'
    );
  });

  test('typesToUnionString preserves namespaces', () => {
    const { ast, services } = parse(`
declare namespace NodeJS {
  interface ErrnoException extends Error {
    errno?: number;
    code?: string;
    path?: string;
  }
}

const error: NodeJS.ErrnoException = new Error() as NodeJS.ErrnoException;
    `);

    const checker = services.program.getTypeChecker();

    /** @type {import('typescript').Type[]} */
    const types = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node).name === 'error'
          ) {
            types.push(services.getTypeAtLocation(node));
          }
        },
      },
    }, true);

    const result = typesToUnionString(checker, types);
    assert.match(
      result,
      /NodeJS\.ErrnoException/,
      `Expected fully qualified name 'NodeJS.ErrnoException' in type string, got: ${result}`
    );
  });

  test('findClosest', () => {
    const { ast } = parse(`
function foo() {
  function bar() {
  }
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration | null} */
    let found = null;
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
            (node).id?.name === 'bar'
          ) {
            found =
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
              (node);
          }
        },
      },
    }, true);

    assert(found);
    const closest = findClosest(
      found, 
      (n) => n.type === AST_NODE_TYPES.FunctionDeclaration
    );

    assert(
      closest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      closest.id?.name === 'bar'
    );
  });

  test('findParent', () => {
    const { ast } = parse(`
function foo() {
  function bar() {
  }
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration | null} */
    let found = null;
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
            (node).id?.name === 'bar'
          ) {
            found =
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
              (node);
          }
        },
      },
    }, true);

    assert(found);
    const closest = findParent(
      found, 
      (n) => n.type === AST_NODE_TYPES.FunctionDeclaration
    );

    assert(
      closest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      closest.id?.name === 'foo'
    );
  });

  test('getCallSignatureDeclaration', () => {
    const { ast, services } = parse(`
/**
 * @throws {number}
 */
function foo(value: number);
/**
 * @throws {string}
 */
function foo(value: string);
function foo(value: number | string) {}

const value = 42;
if (typeof value === 'number') {
  debugger;
  foo(value);
}
    `);

    const callExpression =
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.CallExpression} */
      (getNodeNextToDebugger(ast));

    assert(callExpression);

    const declaration = getCallSignatureDeclaration(services, callExpression);

    assert(declaration);

    const tags = getJSDocThrowsTags(declaration);

    assert.equal(
      tags.every(tag => {
        const text = tag.getFullText();
        return (
          text.includes('@throws {number}') &&
          !text.includes('@throws {string}')
        );
      }),
      true
    );
  });

  test('getCallee', () => {
    const { ast } = parse(`
function foo() {}

const obj = {
  get bar() {},
  set baz(value) {},
};

foo();
const qux = obj.bar;
obj.baz = 42;

debugger;
    `);

    /** @type {Map<string, import('@typescript-eslint/typescript-estree').TSESTree.Node>} */
    const map = new Map();
    simpleTraverse(ast, {
      visitors: {
        [AST_NODE_TYPES.CallExpression](node) {
          map.set(AST_NODE_TYPES.CallExpression, node);
        },
        [AST_NODE_TYPES.MemberExpression](node) {
          if (node.parent?.type === AST_NODE_TYPES.AssignmentExpression) return;

          map.set(AST_NODE_TYPES.MemberExpression, node);
        },
        [AST_NODE_TYPES.AssignmentExpression](node) {
          map.set(AST_NODE_TYPES.AssignmentExpression, node);
        },
      },
    }, true);

    assert.equal(map.size, 3);

    const callExpression =
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.CallExpression} */
      (map.get(AST_NODE_TYPES.CallExpression));
    const memberExpression =
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
      (map.get(AST_NODE_TYPES.MemberExpression));
    const assignmentExpression =
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.AssignmentExpression} */
      (map.get(AST_NODE_TYPES.AssignmentExpression));

    assert(
      getCallee(callExpression)?.type === AST_NODE_TYPES.Identifier &&
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      (getCallee(callExpression))?.name === 'foo'
    );

    assert(
      getCallee(memberExpression)?.type === AST_NODE_TYPES.Identifier &&
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      (getCallee(memberExpression)).name === 'bar',
      'accessing property returns getter and must be named "bar"'
    );

    assert(
      getCallee(assignmentExpression)?.type === AST_NODE_TYPES.MemberExpression &&
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
      (getCallee(assignmentExpression)).property.type === AST_NODE_TYPES.Identifier &&
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      (/** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
        (getCallee(assignmentExpression))
          .property
      ).name === 'baz',
      'assignment to member expression returns setter must be named "baz"'
    );

    // Identifier of expression should be handled as well.
    assert(getCallee(callExpression.callee));
    assert(getCallee(memberExpression.property));

    const debuggerStatement = findDebuggerStatement(ast);

    assert(debuggerStatement);
    assert.equal(
      getCallee(debuggerStatement),
      null,
      'non callable node should return null',
    );
  });

  describe('getCalleeDeclaration', () => {
    test('get declaration of a function calls', () => {
      const { ast, services, sourceCode } = parse(`
// foo declaration
function foo() {}
const obj = {
  // bar declaration
  get bar() {},
  // baz declaration
  set baz(value) {},
};
foo();
const _ = obj.bar;
obj.baz = 42;
      `);

      /** @type {Map<string, import('@typescript-eslint/typescript-estree').TSESTree.Node>} */
      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.CallExpression](node) {
            map.set(AST_NODE_TYPES.CallExpression, node);
          },
          [AST_NODE_TYPES.MemberExpression](node) {
            if (node.parent?.type === AST_NODE_TYPES.AssignmentExpression) return;

            map.set(AST_NODE_TYPES.MemberExpression, node);
          },
          [AST_NODE_TYPES.AssignmentExpression](node) {
            map.set(AST_NODE_TYPES.AssignmentExpression, node);
          },
        },
      }, true);

      assert.equal(map.size, 3);

      const callExpression =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.CallExpression} */
        (map.get(AST_NODE_TYPES.CallExpression));
      const memberExpression =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
        (map.get(AST_NODE_TYPES.MemberExpression));
      const assignmentExpression =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.AssignmentExpression} */
        (map.get(AST_NODE_TYPES.AssignmentExpression));

      assert(
        sourceCode
          .getCommentsBefore(
            services.tsNodeToESTreeNodeMap
              .get(
                /** @type {import('@typescript-eslint/typescript-estree').TSNode} */
                (getCalleeDeclaration(services, callExpression))
              )
          )
          .some(({ value }) => value.includes('foo declaration')),
        '`foo()` must return the declaration of `foo`',
      );

      assert(
        sourceCode
          .getCommentsBefore(
            services.tsNodeToESTreeNodeMap
              .get(
                /** @type {import('@typescript-eslint/typescript-estree').TSNode} */
                (getCalleeDeclaration(services, memberExpression))
              ),
          )
          .some(({ value }) => value.includes('bar declaration')),
        '`const value = obj.bar` must return the declaration of `obj.bar`',
      );

      assert(
        sourceCode
          .getCommentsBefore(
            services.tsNodeToESTreeNodeMap
              .get(
                /** @type {import('@typescript-eslint/typescript-estree').TSNode} */
                (getCalleeDeclaration(services, assignmentExpression))
              ),
          )
          .some(({ value }) => value.includes('baz declaration')),
        '`obj.baz = 42` must return the declaration of `obj.baz`',
      );
    });

    test('return null if it is not getter or setter', () => {
      const { ast, services } = parse(`
const obj = {
  bar: 123,
  baz: 456,
};
const _ = obj.bar;
obj.baz = 42;
      `);

      /** @type {Map<string, import('@typescript-eslint/typescript-estree').TSESTree.Node>} */
      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.MemberExpression](node) {
            if (node.parent?.type === AST_NODE_TYPES.AssignmentExpression) return;
            map.set(AST_NODE_TYPES.MemberExpression, node);
          },
          [AST_NODE_TYPES.AssignmentExpression](node) {
            map.set(AST_NODE_TYPES.AssignmentExpression, node);
          },
        },
      }, true);

      assert.equal(map.size, 2);

      const memberExpression =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
        (map.get(AST_NODE_TYPES.MemberExpression));
      const assignmentExpression =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.AssignmentExpression} */
        (map.get(AST_NODE_TYPES.AssignmentExpression));

      assert.equal(
        getCalleeDeclaration(services, memberExpression),
        null
      );

      assert.equal(
        getCalleeDeclaration(services, assignmentExpression),
        null
      );
    });

    test('non-callable node should return nothing', () => {
      const { ast, services } = parse(`
const a = 42;
a;
      `);

      const identifier = getFirstFoundIdentifier(ast, 'a');
      assert.equal(
        getCalleeDeclaration(services, identifier),
        null,
        'non-callable node should return null',
      );
    });
  });

  test('getJSDocThrowsTags', () => {
    const { ast, services } = parse(`
/**
 * @throws {Error} This throws an error.
 * @throws {TypeError} This also throws a type error.
 */
function foo() {
  if (Math.random() > 0.5) {
    throw new Error();
  } else {
    throw new TypeError();
  }
};
    `);

    let found = null;
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
            (node).id?.name === 'foo'
          ) {
            found = node;
          }
        },
      },
    }, true);

    assert(found);
    const tsNode = services.esTreeNodeToTSNodeMap.get(found);
    const tags = getJSDocThrowsTags(tsNode);

    assert.equal(tags.length, 2);
    assert(tags.every((tag) => tag.typeExpression?.type));

    assert(tags.some((tag) => /This throws an error/.test(String(tag.comment))));
    assert(tags.some((tag) => /This also throws a type error/.test(String(tag.comment))));
  });

  test('getJSDocThrowsTagTypes', () => {
    const { ast, services } = parse(`
/**
 * @throws {Error} This throws an error.
 * @throws {TypeError} This also throws a type error.
 */
function foo() {
  if (Math.random() > 0.5) {
    throw new Error();
  } else {
    throw new TypeError();
  }
};
    `);

    let found = null;
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
            (node).id?.name === 'foo'
          ) {
            found = node;
          }
        },
      },
    }, true);
    assert(found);

    const checker = services.program.getTypeChecker();

    const tsNode = services.esTreeNodeToTSNodeMap.get(found);
    const types = getJSDocThrowsTagTypes(checker, tsNode);

    assert.equal(types.length, 2);

    assert(
      types.every((type) =>
        /^(Error|TypeError)$/.test(checker.typeToString(type)))
    );
  });

  test('toFlattenTypeArray', () => {
    const { ast, services } = parse(`
let a: string = 'foo';
let b: number = 42;
let c: string | number = 'bar';
let d: number | null = null;
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node)
          );
        },
      },
    }, true);

    assert.equal(nodes.length, 4);

    // ['string', 'number', 'string | number', 'number | null']
    const types = nodes.map((node => services.getTypeAtLocation(node)));
    assert.equal(types.length, 4);

    const checker = services.program.getTypeChecker();

    // ['string', 'number', 'string', 'number', 'number', 'null']
    const flattened = toFlattenedTypeArray(types);
    assert.equal(flattened.length, 6);
    assert(
      flattened
        .every((type) => !checker.typeToString(type).includes('|'))
    );
  });

  test('findFunctionCallNodes', () => {
    const { ast, sourceCode } = parse(`
function foo(bar) {
  bar(42);
  bar('bar');
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier | null} */
    let found = null;
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          if (
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node).name === 'bar'
          ) {
            found =
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
              (node);
          }
        },
      },
    }, true);

    assert(found);
    const callExpressions =
      findFunctionCallNodes(sourceCode, found);

    assert.equal(callExpressions.length, 2);
  });

  test('isGeneratorLike', () => {
    const { ast, services } = parse(`
function* foo() {}
async function* bar() {}
    `);
    const checker = services.program.getTypeChecker();
    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
            (node)
          );
        },
      },
    }, true);

    /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */ 
    const getReturnType = (node) => {
      const type = services.getTypeAtLocation(node);
      return checker.getReturnTypeOfSignature(type.getCallSignatures()[0]);
    };

    const fooReturnType = getReturnType(nodes[0]);
    const barReturnType = getReturnType(nodes[1]);

    assert.equal(isGeneratorLike(fooReturnType), true);
    assert.equal(isGeneratorLike(barReturnType), true);
  });

  test('isPromiseType', () => {
    const { ast, services } = parse(`
function foo() {
  return Promise.resolve('foo');
}

function bar() {
  return { then: () => {} };
}
    `);
    const checker = services.program.getTypeChecker();
    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} */
            (node)
          );
        },
      },
    }, true);

    /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */ 
    const getReturnType = (node) => {
      const type = services.getTypeAtLocation(node);
      return checker.getReturnTypeOfSignature(type.getCallSignatures()[0]);
    };

    const fooReturnType = getReturnType(nodes[0]);
    const barReturnType = getReturnType(nodes[1]);

    assert.equal(isPromiseType(services, fooReturnType), true);
    assert.equal(isPromiseType(services, barReturnType), false);
  });

  test('isAccessorNode', () => {
    const { ast } = parse(`
const obj = {
  get foo() { return 42; },
  bar: 'baz',
};
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node)
          );
        },
      },
    }, true);

    const foo = nodes.find((node) => node.name === 'foo');
    const bar = nodes.find((node) => node.name === 'bar');

    assert(foo && foo.parent);
    assert(bar && bar.parent);

    assert.equal(isAccessorNode(foo.parent), true);
    assert.equal(isAccessorNode(bar.parent), false);
  });

  test('findClosestFunctionNode', () => {
    const { ast } = parse(`
const foo = 'baz';
const buzz = 42;

function bar() {
  function fizz() {
    console.log(buzz);
  }
  return foo;
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator) return;
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node)
          );
        },
      },
    }, true);

    const foo = nodes.find((node) => node.name === 'foo');
    assert(foo);
    const fooClosest = findClosestFunctionNode(foo);
    assert(
      fooClosest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      fooClosest.id?.name === 'bar',
    );

    const buzz = nodes.find((node) => node.name === 'buzz');
    assert(buzz);
    const buzzClosest = findClosestFunctionNode(buzz);
    assert(
      buzzClosest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      buzzClosest.id?.name === 'fizz',
    );
  });

  test('isPromiseConstructorCallbackNode', () => {
    const { ast } = parse(`
function foo() {
  return new Promise((resolve) => {});
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node)
          );
        },
      },
    }, true);

    const resolve = nodes.find((node) => node.name === 'resolve');
    const callback = resolve?.parent;
    assert(callback);

    assert.equal(isPromiseConstructorCallbackNode(callback), true);

    const foo = nodes.find((node) => node.name === 'foo');
    assert(foo);
    assert.equal(isPromiseConstructorCallbackNode(foo), false);
  });

  test('isThenableCallbackNode', () => {
    const { ast } = parse(`
function foo() {
  return Promise((resolve, reject) => {
    resolve(42);
  })
    .then((num) => {
      console.log(typeof num);
      return String(num);
    })
    .catch((e) => console.error(e))
    .finally((str) => {
      console.log(str);
    });
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          if (node.parent?.type !== AST_NODE_TYPES.ArrowFunctionExpression) {
            return;
          }
          nodes.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node)
          );
        },
      },
    }, true);


    assert.equal(
      isThenableCallbackNode(
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ArrowFunctionExpression} */
        (nodes
          .find((node) => node.name === 'num')
          ?.parent)
      ),
      true,
    );

    assert.equal(
      isThenableCallbackNode(
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ArrowFunctionExpression} */
        (nodes
          .find((node) => node.name === 'str')
          ?.parent)
      ),
      true,
    );

    assert.equal(
      isThenableCallbackNode(
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ArrowFunctionExpression} */
        (nodes
          .find((node) => node.name === 'resolve')
          ?.parent)
      ),
      false,
    );
  });

  describe('findNodeToComment', () => {
    test('comment to declared function', () => {
      const { ast, sourceCode } = parse(`
// here
function foo() {}
    `);

      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.FunctionDeclaration](node) {
            map.set(AST_NODE_TYPES.FunctionDeclaration, node);
          },
        },
      }, true);

      const functionDeclaration = map.get(AST_NODE_TYPES.FunctionDeclaration);

      assert.equal(
        sourceCode
          .getCommentsBefore(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Node} */
            (findNodeToComment(functionDeclaration))
          )
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('comment to assigned arrow function', () => {
      const { ast, sourceCode } = parse(`
// here
const foo = () => {};
    `);

      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.ArrowFunctionExpression](node) {
            map.set(AST_NODE_TYPES.ArrowFunctionExpression, node);
          },
        },
      }, true);

      const arrowFunction = map.get(AST_NODE_TYPES.ArrowFunctionExpression);

      assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      assert.equal(
        sourceCode
          .getCommentsBefore(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Node} */
            (findNodeToComment(arrowFunction))
          )
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('comment to exported assigned arrow function', () => {
      const { ast, sourceCode } = parse(`
// here
export const foo = () => {};
    `);

      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.ArrowFunctionExpression](node) {
            map.set(AST_NODE_TYPES.ArrowFunctionExpression, node);
          },
        },
      }, true);

      const arrowFunction = map.get(AST_NODE_TYPES.ArrowFunctionExpression);

      assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      assert.equal(
        sourceCode
          .getCommentsBefore(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Node} */
            (findNodeToComment(arrowFunction))
          )
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('find node to comment from promise constructor', () => {
      const { ast, sourceCode } = parse(`
// here
export const foo = () => {
  return new Promise((resolve) => {});
  //                 ^ node
};
    `);

      /** @type {Map<string, import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.Identifier](node) {
            map.set(
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
              (node).name,
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
              (node)
            );
          },
        },
      }, true);

      const resolveIdentifier = map.get('resolve');
      const arrowFunction = resolveIdentifier?.parent;

      assert(arrowFunction);
      assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      assert.equal(
        sourceCode
          .getCommentsBefore(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Node} */
            (findNodeToComment(
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ArrowFunctionExpression} */
              (arrowFunction)
            ))
          )
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('find node to comment from promise chain method', () => {
      const { ast, sourceCode } = parse(`
// here
export const foo = () => {
  return Promise.resolve()
    .then((value) => {});
};
    `);

      /** @type {Map<string, import('@typescript-eslint/typescript-estree').TSESTree.Identifier>} */
      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.Identifier](node) {
            map.set(
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
              (node).name,
              /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
              (node)
            );
          },
        },
      }, true);

      const identifier = map.get('value');
      const arrowFunction =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ArrowFunctionExpression} */
        (identifier?.parent);
      assert(arrowFunction);

      assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      assert.equal(
        sourceCode
          .getCommentsBefore(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Node} */
            (findNodeToComment(arrowFunction))
          )
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });
  });

  describe('findIdentifierDeclaration', () => {
    test('reference function declaration', () => {
      const { ast, sourceCode } = parse(`
function foo() {}

debugger;
foo;
    `);

      const identifier =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
        (getNodeNextToDebugger(ast));

      const declaration =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration | null} */
        (findIdentifierDeclaration(sourceCode, identifier));

      assert(declaration);
      assert.equal(declaration.type, AST_NODE_TYPES.FunctionDeclaration);
      assert.equal(declaration.id?.name, 'foo');
    });

    test('reference variable', () => {
      const { ast, sourceCode } = parse(`
const foo = function () {};

debugger;
foo;
    `);

      const identifier =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
        (getNodeNextToDebugger(ast));

      const declaration =
        /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration | null} */
        (findIdentifierDeclaration(sourceCode, identifier));

      assert(declaration);
      assert.equal(declaration.type, AST_NODE_TYPES.FunctionExpression);
    });
  });

  describe('isInHandledContext', () => {
    test('in try with catch clause', () => {
      const { ast } = parse(`
try {
  debugger;
} catch (e) {}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      assert(debuggerStatement);
      assert.equal(isInHandledContext(debuggerStatement), true);
    });

    test('in try without catch clause', () => {
      const { ast } = parse(`
try {
  debugger;
} finally {}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      assert(debuggerStatement);
      assert.equal(isInHandledContext(debuggerStatement), false);
    });

    test('in catch clause', () => {
      const { ast } = parse(`
try {
} catch {
  debugger;
}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      assert(debuggerStatement);
      assert.equal(isInHandledContext(debuggerStatement), false);
    });

    test('in finally block', () => {
      const { ast } = parse(`
try {
} catch {
} finally {
  debugger;
}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      assert(debuggerStatement);
      assert.equal(isInHandledContext(debuggerStatement), false);
    });

    test('in nested context', () => {
      const { ast } = parse(`
try {
  try {
  } finally {
    debugger;
  }
} catch {}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      assert(debuggerStatement);
      assert.equal(isInHandledContext(debuggerStatement), true);
    });
  });

  describe('isInAsyncHandledContext', () => {
    test('using catch method', () => {
      const { ast, sourceCode } = parse(`
foo().catch(console.error);
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('using then reject handler', () => {
      const { ast, sourceCode } = parse(`
foo().then(() => {}, console.error);
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('without then reject handler', () => {
      const { ast, sourceCode } = parse(`
foo().then(() => {});
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('catch method after then method', () => {
      const { ast, sourceCode } = parse(`
foo().then(() => {}).catch(console.error);
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try with catch clause', () => {
      const { ast, sourceCode } = parse(`
try {
  await foo();
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try with catch clause without await', () => {
      const { ast, sourceCode } = parse(`
try {
  foo();
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in try with catch clause without await, with catch method', () => {
      const { ast, sourceCode } = parse(`
try {
  foo().catch(console.error);
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try with catch clause with await, with catch method', () => {
      const { ast, sourceCode } = parse(`
try {
  await foo().catch(console.error);
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try without catch clause', () => {
      const { ast, sourceCode } = parse(`
try {
  await foo();
} finally {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in catch clause', () => {
      const { ast, sourceCode } = parse(`
try {
} catch {
  await foo();
}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in finally block', () => {
      const { ast, sourceCode } = parse(`
try {
} catch {
} finally {
  await foo();
}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in nested context', () => {
      const { ast, sourceCode } = parse(`
try {
  try {
  } finally {
    await foo();
  }
} catch {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in nested context without await', () => {
      const { ast, sourceCode } = parse(`
try {
  try {
  } finally {
    foo();
  }
} catch {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });
  });

  describe('isNodeReturned', () => {
    test('return inside function', () => {
      const { ast } = parse(`
function foo() {
  return bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), true);
    });

    test('not last item of sequence expression', () => {
      const { ast } = parse(`
function foo() {
  return bar, 42;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), false);
    });

    test('last item of sequence expression', () => {
      const { ast } = parse(`
function foo() {
  return 42, bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), true);
    });

    test('after return statement', () => {
      const { ast } = parse(`
function foo() {
  return;
  bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), false);
    });

    test('arrow function with no block statement', () => {
      const { ast } = parse(`
const foo = () => bar;
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), true);
    });

    test('arrow function with block statement, no return', () => {
      const { ast } = parse(`
const foo = () => {
  bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), false);
    });

    test('arrow function with block statement, with return', () => {
      const { ast } = parse(`
const foo = () => {
  return bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      assert.equal(isNodeReturned(bar), true);
    });
  });
});

const tsconfigRootDir = __dirname;
const program = createProgram('tsconfig.json', tsconfigRootDir);

/**
 * @param {string} code
 */
function parse(code) {
  const parsed = parseForESLint(code, {
    tsconfigRootDir,
    filePath: __filename,
    programs: [program],
    projectService: true,
    errorOnUnknownASTType: true,
    project: true,
    comment: true,
    loc: true,
    range: true,
    tokens: true,
    jsDocParsingMode: 'all',
  });

  return {
    ...parsed,
    services: /** @type {import('@typescript-eslint/utils').ParserServicesWithTypeInformation} */(
      parsed.services
    ),
    // @ts-expect-error - incompatible
    sourceCode: new TSESLint.SourceCode({
      ...parsed,
      parserServices: parsed.services,
      text: code,
    }),
  };
}

/**
 * @param {import('@typescript-eslint/typescript-estree').TSESTree.Node} node
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Node | null}
 */
const getNodeNextTo = (node) => {
  switch (node.parent?.type) {
    case AST_NODE_TYPES.Program:
    case AST_NODE_TYPES.BlockStatement: {
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.BlockStatement['body']} */
      const body = [...node.parent.body];
      return body[body.findIndex((n) => n === node) + 1] ?? null;
    }
    default:
      break;
  }
  return null;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST<any>} ast
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement | null}
 */
const findDebuggerStatement = (ast) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement | null} */
  let found = null;
  simpleTraverse(ast, {
    visitors: {
      [AST_NODE_TYPES.DebuggerStatement](node) {
        found =
          /** @type {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement} */
          (node);
      },
    },
  }, true);

  return found;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST<any>} ast
 * @param {string} name
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]}
 */
const findIdentifiers = (ast, name) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
  const ids = [];
  simpleTraverse(ast, {
    visitors: {
      [AST_NODE_TYPES.Identifier](node) {
        if (
          /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
          (node).name === name
        ) {
          ids.push(
            /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
            (node)
          );
        }
      },
    },
  }, true);

  return ids;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST<any>} ast
 * @param {string} name
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Identifier}
 */
const getFirstFoundIdentifier = (ast, name) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
  const ids = findIdentifiers(ast, name);
  return ids[0] ?? null;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST<any>} ast
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Node | null}
 */
const getNodeNextToDebugger = (ast) => {
  const debuggerStatement =
    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement} */
    (findDebuggerStatement(ast));

  const found =
    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ExpressionStatement} */
    (getNodeNextTo(debuggerStatement));

  return found.expression;
};
