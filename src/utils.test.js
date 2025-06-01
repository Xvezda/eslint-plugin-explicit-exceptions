/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
const { test, describe } = require('node:test');
const path = require('node:path');

const { TSESLint, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const { simpleTraverse } = require('@typescript-eslint/typescript-estree');
const { parseForESLint: parse } = require('@typescript-eslint/parser');

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
} = require('./utils');

/**
 * @param {string} code
 */
function parseCode(code) {
  const parsed = parse(code, {
    tsconfigRootDir: path.resolve(path.join(__dirname, '..')),
    filePath: __filename,
    projectService: {
      defaultProject: 'tsconfig-test.json',
    },
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

describe('utils', () => {
  test('TypeMap', (t) => {
    const { ast, services } = parseCode(`
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
    const { ast, sourceCode } = parseCode(`
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
    const { ast } = parseCode(`
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
    const { ast, sourceCode } = parseCode(`
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
    const { ast, sourceCode } = parseCode(`
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
    const { ast, services } = parseCode(`
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
    const { ast } = parseCode(`
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
    const { ast } = parseCode(`
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
    const { ast } = parseCode(`
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
      const { ast, services, sourceCode } = parseCode(`
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
      const { ast, services } = parseCode(`
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
});
