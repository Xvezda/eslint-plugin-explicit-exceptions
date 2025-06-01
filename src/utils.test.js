/* eslint-disable @typescript-eslint/no-floating-promises */
const { test, describe } = require('node:test');
const path = require('node:path');

const { TSESLint, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const { simpleTraverse } = require('@typescript-eslint/typescript-estree');
const { parseForESLint: parse } = require('@typescript-eslint/parser');

const {
  TypeMap,
  getFirst,
  getLast,
  hasThrowsTag,
  getNodeIndent,
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
    sourceCode: new TSESLint.SourceCode({
      ...parsed,
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
    });

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
    });

    t.assert.equal(functionNodes.length, 2);

    const foo = functionNodes.find((node) =>
      node.type === AST_NODE_TYPES.FunctionDeclaration &&
      node.id.name === 'foo'
    );

    t.assert.equal(
      hasThrowsTag(commentsToString(sourceCode.getCommentsBefore(foo))),
      false,
    );
    
    const bar = functionNodes.find((node) =>
      node.type === AST_NODE_TYPES.FunctionDeclaration &&
      node.id.name === 'bar'
    );

    t.assert.equal(
      hasThrowsTag(commentsToString(sourceCode.getCommentsBefore(bar))),
      true,
    );
  });

  test('getNodeIndent', (t, done) => {
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
            done();
          }
        },
      },
    });
  });
});
