/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
const { test, describe } = require('node:test');
const path = require('node:path');

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
  getCallee,
  getCalleeDeclaration,
  getJSDocThrowsTags,
  getJSDocThrowsTagTypes,
  toFlattenedTypeArray,
  findFunctionCallNodes,
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
} = require('./utils');

describe('utils', () => {
  test('TypeMap', (t) => {
    const { ast, services } = parse(`
function foo() {
  const a: number = 42;
  const b: string = 'foo';
}
    `);
    const ids = new Map();
    simpleTraverse(ast, {
      visitors: {
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} node */
        Identifier(node) {
          ids.set(node.name, node);
        },
      },
    }, true);

    const foo = ids.get('foo');
    const a = ids.get('a');
    const b = ids.get('b');
    const aType = services.getTypeAtLocation(a);
    const bType = services.getTypeAtLocation(b);

    const typeMap = new TypeMap();

    t.assert.deepEqual([], typeMap.get(foo));

    typeMap.add(foo, [aType]);

    t.assert.deepEqual([aType], typeMap.get(foo));

    typeMap.add(foo, [bType]);

    t.assert.deepEqual([aType, bType], typeMap.get(foo));
  });

  test('getFirst', (t) => {
    t.assert.equal(getFirst([]), null);
    t.assert.equal(getFirst([42]), 42);
    t.assert.equal(getFirst(['foo', 'bar']), 'foo');
  });

  test('getLast', (t) => {
    t.assert.equal(getLast([]), null);
    t.assert.equal(getLast([42]), 42);
    t.assert.equal(getLast(['foo', 'bar']), 'bar');
  });

  test('getNodeIndent', (t) => {
    const { ast, sourceCode } = parse(`
function foo() {
  const bar: string = 'baz';
}
    `);

    simpleTraverse(ast, {
      visitors: {
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} node */
        Identifier(node) {
          if (node.name === 'bar') {
            const indent = getNodeIndent(sourceCode, node);
            t.assert.equal(indent.length, 2);
          }
        },
      },
    }, true);
  });

  test('getNodeID', (t) => {
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

    t.assert.equal(ids.size, 4);
  });

  test('hasThrowsTag', (t) => {
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
        /** @param {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} node */
        FunctionDeclaration(node) {
          functionNodes.push(node);
        },
      },
    }, true);

    t.assert.equal(functionNodes.length, 2);

    const foo = functionNodes.find((node) => node.id.name === 'foo');

    t.assert.equal(
      hasThrowsTag(commentsToString(sourceCode.getCommentsBefore(foo))),
      false,
    );
    
    const bar = functionNodes.find((node) => node.id.name === 'bar');

    t.assert.equal(
      hasThrowsTag(commentsToString(sourceCode.getCommentsBefore(bar))),
      true,
    );
  });

  test('hasJSDocThrowsTag', (t) => {
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
        /** @param {import('@typescript-eslint/utils').TSESTree.FunctionDeclaration} node */
        FunctionDeclaration(node) {
          functionNodes.push(node);
        },
      },
    }, true);

    const foo = functionNodes.find((node) =>
      node.id.name === 'foo'
    );

    t.assert.equal(hasJSDocThrowsTag(sourceCode, foo), false);
    
    const bar = functionNodes.find((node) => node.id.name === 'bar');

    t.assert.equal(hasJSDocThrowsTag(sourceCode, bar), true);
  });

  test('typeStringsToUnionString', (t) => {
    t.assert.equal(typeStringsToUnionString(['string']), 'string');
    t.assert.equal(typeStringsToUnionString(['string', 'number']), 'string | number');
  });

  test('typesToUnionString', (t) => {
    const { ast, services } = parse(`
const a: number = 42;
const b: string = 'foo';
const c: string = 'bar';
const d: number = 123;
const e: string = 'baz';
const f: number = 456;
    `);

    const checker = services.program.getTypeChecker();

    const types = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          types.push(services.getTypeAtLocation(node));
        },
      },
    }, true);

    t.assert.equal(
      typesToUnionString(checker, types),
      'number | string'
    );
  });

  test('findClosest', (t) => {
    const { ast } = parse(`
function foo() {
  function bar() {
  }
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier | null} */
    let found = null;
    simpleTraverse(ast, {
      visitors: {
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */
        FunctionDeclaration(node) {
          if (node.id.name === 'bar') {
            found = node;
          }
        },
      },
    }, true);

    const closest = findClosest(
      found, 
      (n) => n.type === AST_NODE_TYPES.FunctionDeclaration
    );

    t.assert.ok(
      closest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      closest.id.name === 'bar'
    );
  });

  test('findParent', (t) => {
    const { ast } = parse(`
function foo() {
  function bar() {
  }
}
    `);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier | null} */
    let found = null;
    simpleTraverse(ast, {
      visitors: {
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */
        FunctionDeclaration(node) {
          if (node.id.name === 'bar') {
            found = node;
          }
        },
      },
    }, true);

    const closest = findParent(
      found, 
      (n) => n.type === AST_NODE_TYPES.FunctionDeclaration
    );

    t.assert.ok(
      closest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      closest.id.name === 'foo'
    );
  });

  test('getCallee', (t) => {
    const { ast } = parse(`
function foo() {}

const obj = {
  get bar() {},
  set baz(value) {},
};

foo();
const qux = obj.bar;
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

    t.assert.equal(map.size, 3);

    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.CallExpression} */
    const callExpression = map.get(AST_NODE_TYPES.CallExpression);
    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
    const memberExpression = map.get(AST_NODE_TYPES.MemberExpression);
    /** @type {import('@typescript-eslint/typescript-estree').TSESTree.AssignmentExpression} */
    const assignmentExpression = map.get(AST_NODE_TYPES.AssignmentExpression);

    t.assert.ok(
      getCallee(callExpression).type === AST_NODE_TYPES.Identifier &&
      getCallee(callExpression).name === 'foo'
    );

    t.assert.ok(
      getCallee(memberExpression).type === AST_NODE_TYPES.Identifier &&
      getCallee(memberExpression).name === 'bar',
      'accessing property returns getter and must be named "bar"'
    );

    t.assert.ok(
      getCallee(assignmentExpression).type === AST_NODE_TYPES.MemberExpression &&
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
      (getCallee(assignmentExpression)).property.type === AST_NODE_TYPES.Identifier &&
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
      (getCallee(assignmentExpression)).property.name === 'baz',
      'assignment to member expression returns setter must be named "baz"'
    );
  });

  describe('getCalleeDeclaration', () => {
    test('get declaration of a function calls', (t) => {
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

      t.assert.equal(map.size, 3);

      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.CallExpression} */
      const callExpression = map.get(AST_NODE_TYPES.CallExpression);
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
      const memberExpression = map.get(AST_NODE_TYPES.MemberExpression);
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.AssignmentExpression} */
      const assignmentExpression = map.get(AST_NODE_TYPES.AssignmentExpression);

      t.assert.ok(
        sourceCode
          .getCommentsBefore(
            services.tsNodeToESTreeNodeMap
              .get(getCalleeDeclaration(services, callExpression))
          )
          .some(({ value }) => value.includes('foo declaration')),
        '`foo()` must return the declaration of `foo`',
      );

      t.assert.ok(
        sourceCode
          .getCommentsBefore(
            services.tsNodeToESTreeNodeMap
              .get(getCalleeDeclaration(services, memberExpression)),
          )
          .some(({ value }) => value.includes('bar declaration')),
        '`const value = obj.bar` must return the declaration of `obj.bar`',
      );

      t.assert.ok(
        sourceCode
          .getCommentsBefore(
            services.tsNodeToESTreeNodeMap
              .get(getCalleeDeclaration(services, assignmentExpression)),
          )
          .some(({ value }) => value.includes('baz declaration')),
        '`obj.baz = 42` must return the declaration of `obj.baz`',
      );
    });

    test('return null if it is not getter or setter', (t) => {
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

      t.assert.equal(map.size, 2);

      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.MemberExpression} */
      const memberExpression = map.get(AST_NODE_TYPES.MemberExpression);
      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.AssignmentExpression} */
      const assignmentExpression = map.get(AST_NODE_TYPES.AssignmentExpression);

      t.assert.equal(
        getCalleeDeclaration(services, memberExpression),
        null
      );

      t.assert.equal(
        getCalleeDeclaration(services, assignmentExpression),
        null
      );
    });
  });

  test('getJSDocThrowsTags', (t) => {
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
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */
        FunctionDeclaration(node) {
          if (node.id.name === 'foo') {
            found = node;
          }
        },
      },
    }, true);

    const tsNode = services.esTreeNodeToTSNodeMap.get(found);
    const tags = getJSDocThrowsTags(tsNode);

    t.assert.equal(tags.length, 2);
    t.assert.ok(tags.every((tag) => tag.typeExpression?.type));

    t.assert.ok(tags.some((tag) => /This throws an error/.test(tag.comment)));
    t.assert.ok(tags.some((tag) => /This also throws a type error/.test(tag.comment)));
  });

  test('getJSDocThrowsTagTypes', (t) => {
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
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */
        FunctionDeclaration(node) {
          if (node.id.name === 'foo') {
            found = node;
          }
        },
      },
    }, true);

    const checker = services.program.getTypeChecker();

    const tsNode = services.esTreeNodeToTSNodeMap.get(found);
    const types = getJSDocThrowsTagTypes(checker, tsNode);

    t.assert.equal(types.length, 2);

    t.assert.ok(
      types.every((type) =>
        /^(Error|TypeError)$/.test(checker.typeToString(type)))
    );
  });

  test('toFlattenTypeArray', (t) => {
    const { ast, services } = parse(`
let a: string = 'foo';
let b: number = 42;
let c: string | number = 'bar';
let d: number | null = null;
    `);

    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        Identifier(node) {
          nodes.push(node);
        },
      },
    }, true);

    t.assert.equal(nodes.length, 4);

    // ['string', 'number', 'string | number', 'number | null']
    const types = nodes.map((node => services.getTypeAtLocation(node)));
    t.assert.equal(types.length, 4);

    const checker = services.program.getTypeChecker();

    // ['string', 'number', 'string', 'number', 'number', 'null']
    const flattened = toFlattenedTypeArray(types);
    t.assert.equal(flattened.length, 6);
    t.assert.ok(
      flattened
        .every((type) => !checker.typeToString(type).includes('|'))
    );
  });

  test('findFunctionCallNodes', (t) => {
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
        /** @param {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration} node */
        Identifier(node) {
          if (node.name === 'bar') {
            found = node;
          }
        },
      },
    }, true);

    const callExpressions =
      findFunctionCallNodes(sourceCode, found);

    t.assert.equal(callExpressions.length, 2);
  });

  test('isPromiseType', (t) => {
    const { ast, services } = parse(`
function foo() {
  return Promise.resolve('foo');
}

function bar() {
  return { then: () => {} };
}
    `);
    const checker = services.program.getTypeChecker();
    const nodes = [];
    simpleTraverse(ast, {
      visitors: {
        FunctionDeclaration(node) {
          nodes.push(node);
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

    t.assert.equal(isPromiseType(services, fooReturnType), true);
    t.assert.equal(isPromiseType(services, barReturnType), false);
  });

  test('isAccessorNode', (t) => {
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
          nodes.push(node);
        },
      },
    }, true);

    const foo = nodes.find((node) => node.name === 'foo');
    const bar = nodes.find((node) => node.name === 'bar');

    t.assert.equal(isAccessorNode(foo.parent), true);
    t.assert.equal(isAccessorNode(bar.parent), false);
  });

  test('findClosestFunctionNode', (t) => {
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
          if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) return;
          nodes.push(node);
        },
      },
    }, true);

    const foo = nodes.find((node) => node.name === 'foo');

    const fooClosest = findClosestFunctionNode(foo);
    t.assert.ok(
      fooClosest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      fooClosest.id.name === 'bar',
    );

    const buzz = nodes.find((node) => node.name === 'buzz');
    const buzzClosest = findClosestFunctionNode(buzz);
    t.assert.ok(
      buzzClosest?.type === AST_NODE_TYPES.FunctionDeclaration &&
      buzzClosest.id.name === 'fizz',
    );
  });

  test('isPromiseConstructorCallbackNode', (t) => {
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
          nodes.push(node);
        },
      },
    }, true);

    const resolve = nodes.find((node) => node.name === 'resolve');
    const callback = resolve?.parent;

    t.assert.equal(isPromiseConstructorCallbackNode(callback), true);

    const foo = nodes.find((node) => node.name === 'foo');
    t.assert.equal(isPromiseConstructorCallbackNode(foo), false);
  });

  test('isThenableCallbackNode', (t) => {
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
          nodes.push(node);
        },
      },
    }, true);


    t.assert.equal(
      isThenableCallbackNode(
        nodes
        .find((node) => node.name === 'num')
        ?.parent
      ),
      true,
    );

    t.assert.equal(
      isThenableCallbackNode(
        nodes
        .find((node) => node.name === 'str')
        ?.parent
      ),
      true,
    );

    t.assert.equal(
      isThenableCallbackNode(
        nodes
        .find((node) => node.name === 'resolve')
        ?.parent
      ),
      false,
    );
  });

  describe('findNodeToComment', () => {
    test('comment to declared function', (t) => {
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

      t.assert.equal(
        sourceCode
          .getCommentsBefore(findNodeToComment(functionDeclaration))
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('comment to assigned arrow function', (t) => {
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

      t.assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      t.assert.equal(
        sourceCode
          .getCommentsBefore(findNodeToComment(arrowFunction))
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('comment to exported assigned arrow function', (t) => {
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

      t.assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      t.assert.equal(
        sourceCode
          .getCommentsBefore(findNodeToComment(arrowFunction))
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('find node to comment from promise constructor', (t) => {
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
            map.set(node.name, node);
          },
        },
      }, true);

      const resolveIdentifier = map.get('resolve');
      const arrowFunction = resolveIdentifier?.parent;

      t.assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      t.assert.equal(
        sourceCode
          .getCommentsBefore(findNodeToComment(arrowFunction))
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });

    test('find node to comment from promise chain method', (t) => {
      const { ast, sourceCode } = parse(`
// here
export const foo = () => {
  return Promise.resolve()
    .then((value) => {});
};
    `);

      /** @type {Map<string, import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      const map = new Map();
      simpleTraverse(ast, {
        visitors: {
          [AST_NODE_TYPES.Identifier](node) {
            map.set(node.name, node);
          },
        },
      }, true);

      const identifier = map.get('value');
      const arrowFunction = identifier?.parent;

      t.assert.equal(
        sourceCode.getCommentsBefore(arrowFunction).length,
        0,
      );

      t.assert.equal(
        sourceCode
          .getCommentsBefore(findNodeToComment(arrowFunction))
          .some((comment) => comment.value.includes('here')),
        true,
      );
    });
  });

  describe('findIdentifierDeclaration', () => {
    test('reference function declaration', (t) => {
      const { ast, sourceCode } = parse(`
function foo() {}

debugger;
foo;
    `);

      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      const identifier = getNodeNextToDebugger(ast);

      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration | null} */
      const declaration =
        findIdentifierDeclaration(sourceCode, identifier);

      t.assert.ok(declaration);
      t.assert.equal(declaration.type, AST_NODE_TYPES.FunctionDeclaration);
      t.assert.equal(declaration.id.name, 'foo');
    });

    test('reference variable', (t) => {
      const { ast, sourceCode } = parse(`
const foo = function () {};

debugger;
foo;
    `);

      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier} */
      const identifier = getNodeNextToDebugger(ast);

      /** @type {import('@typescript-eslint/typescript-estree').TSESTree.FunctionDeclaration | null} */
      const declaration =
        findIdentifierDeclaration(sourceCode, identifier);

      t.assert.ok(declaration);
      t.assert.equal(declaration.type, AST_NODE_TYPES.FunctionExpression);
    });
  });

  describe('isInHandledContext', () => {
    test('in try with catch clause', (t) => {
      const { ast } = parse(`
try {
  debugger;
} catch (e) {}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      t.assert.equal(isInHandledContext(debuggerStatement), true);
    });

    test('in try without catch clause', (t) => {
      const { ast } = parse(`
try {
  debugger;
} finally {}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      t.assert.equal(isInHandledContext(debuggerStatement), false);
    });

    test('in catch clause', (t) => {
      const { ast } = parse(`
try {
} catch {
  debugger;
}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      t.assert.equal(isInHandledContext(debuggerStatement), false);
    });

    test('in finally block', (t) => {
      const { ast } = parse(`
try {
} catch {
} finally {
  debugger;
}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      t.assert.equal(isInHandledContext(debuggerStatement), false);
    });

    test('in nested context', (t) => {
      const { ast } = parse(`
try {
  try {
  } finally {
    debugger;
  }
} catch {}
      `);

      const debuggerStatement = findDebuggerStatement(ast);
      t.assert.equal(isInHandledContext(debuggerStatement), true);
    });
  });

  describe('isInAsyncHandledContext', () => {
    test('using catch method', (t) => {
      const { ast, sourceCode } = parse(`
foo().catch(console.error);
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('using then reject handler', (t) => {
      const { ast, sourceCode } = parse(`
foo().then(() => {}, console.error);
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('without then reject handler', (t) => {
      const { ast, sourceCode } = parse(`
foo().then(() => {});
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('catch method after then method', (t) => {
      const { ast, sourceCode } = parse(`
foo().then(() => {}).catch(console.error);
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try with catch clause', (t) => {
      const { ast, sourceCode } = parse(`
try {
  await foo();
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try with catch clause without await', (t) => {
      const { ast, sourceCode } = parse(`
try {
  foo();
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in try with catch clause without await, with catch method', (t) => {
      const { ast, sourceCode } = parse(`
try {
  foo().catch(console.error);
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try with catch clause with await, with catch method', (t) => {
      const { ast, sourceCode } = parse(`
try {
  await foo().catch(console.error);
} catch (e) {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in try without catch clause', (t) => {
      const { ast, sourceCode } = parse(`
try {
  await foo();
} finally {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in catch clause', (t) => {
      const { ast, sourceCode } = parse(`
try {
} catch {
  await foo();
}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in finally block', (t) => {
      const { ast, sourceCode } = parse(`
try {
} catch {
} finally {
  await foo();
}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });

    test('in nested context', (t) => {
      const { ast, sourceCode } = parse(`
try {
  try {
  } finally {
    await foo();
  }
} catch {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), true);
    });

    test('in nested context without await', (t) => {
      const { ast, sourceCode } = parse(`
try {
  try {
  } finally {
    foo();
  }
} catch {}
      `);

      const foo = getFirstFoundIdentifier(ast, 'foo');
      t.assert.equal(isInAsyncHandledContext(sourceCode, foo), false);
    });
  });

  describe('isNodeReturned', () => {
    test('return inside function', (t) => {
      const { ast } = parse(`
function foo() {
  return bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      t.assert.equal(isNodeReturned(bar), true);
    });

    test('after return statement', (t) => {
      const { ast } = parse(`
function foo() {
  return;
  bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      t.assert.equal(isNodeReturned(bar), false);
    });

    test('arrow function with no block statement', (t) => {
      const { ast } = parse(`
const foo = () => bar;
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      t.assert.equal(isNodeReturned(bar), true);
    });

    test('arrow function with block statement, no return', (t) => {
      const { ast } = parse(`
const foo = () => {
  bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      t.assert.equal(isNodeReturned(bar), false);
    });

    test('arrow function with block statement, with return', (t) => {
      const { ast } = parse(`
const foo = () => {
  return bar;
}
      `);

      const bar = getFirstFoundIdentifier(ast, 'bar');
      t.assert.equal(isNodeReturned(bar), true);
    });
  });
});

const tsconfigRootDir = path.resolve(path.join(__dirname, '..'));
const program = createProgram('tsconfig-test.json', tsconfigRootDir);

/**
 * @param {string} code
 */
function parse(code) {
  const parsed = parseForESLint(code, {
    tsconfigRootDir,
    filePath: __filename,
    programs: [program],
    projectService: {
      allowDefaultProject: ['*.js', '*.ts*'],
    },
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
  switch (node.parent.type) {
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
 * @param {import('@typescript-eslint/typescript-estree').AST} ast
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement | null}
 */
const findDebuggerStatement = (ast) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement | null} */
  let found = null;
  simpleTraverse(ast, {
    visitors: {
      [AST_NODE_TYPES.DebuggerStatement](node) {
        found = node;
      },
    },
  }, true);

  return found;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST} ast
 * @param {string} name
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]}
 */
const findIdentifiers = (ast, name) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
  const ids = [];
  simpleTraverse(ast, {
    visitors: {
      [AST_NODE_TYPES.Identifier](node) {
        if (node.name === name) {
          ids.push(node);
        }
      },
    },
  }, true);

  return ids;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST} ast
 * @param {string} name
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]}
 */
const getFirstFoundIdentifier = (ast, name) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.Identifier[]} */
  const ids = findIdentifiers(ast, name);
  return ids[0] ?? null;
};

/**
 * @param {import('@typescript-eslint/typescript-estree').AST} ast
 * @returns {import('@typescript-eslint/typescript-estree').TSESTree.Node | null}
 */
const getNodeNextToDebugger = (ast) => {
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.DebuggerStatement} */
  const debuggerStatement = findDebuggerStatement(ast);
  /** @type {import('@typescript-eslint/typescript-estree').TSESTree.ExpressionStatement} */
  const found = getNodeNextTo(debuggerStatement);

  return found.expression;
};
