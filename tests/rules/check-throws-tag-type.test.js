// @ts-check
const path = require('node:path');
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('../../src/rules/check-throws-tag-type');

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: path.resolve(path.join(__dirname, '..')),
      projectService: {
        allowDefaultProject: [
          '*.ts',
          '*.js',
        ],
      },
      JSDocParsingMode: 'all',
    },
  },
});

ruleTester.run(
  'check-throws-tag-type',
  rule,
  {
    valid: [
      {
        code: `
          /** @throws {"lol" | 42} */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
      },
      {
        code: `
          /** @throws {string | 42} */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {string | number}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
      },
      {
        code: `
          function foo(resolve, reject) {
            reject(new Error());
          }

          /**
           * @throws {Promise<Error>}
           */
          function bar() {
            return new Promise(foo);
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function foo(resolve, reject) {
            throw new Error();
          }

          /**
           * @throws {Promise<Error>}
           */
          function bar() {
            return new Promise(foo);
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function* g() {
            throw new TypeError();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function f() {
            for (const x of g()) {}
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function f() {
            [...g()];
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function f() {
            Array.from(g());
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function* h() {
            yield* g();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function h() {
            g().next();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          function h() {
            g();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function f() {
            for await (const x of g()) {}
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function f() {
            await Array.fromAsync(g());
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function* h() {
            yield* g();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function h() {
            await g().next();
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {null}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string | number}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        errors: [{ messageId: 'throwTypeMismatch' }],
        options: [{ useBaseTypeOfLiteral: true }],
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {null}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {"lol"}
           * @throws {42}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        errors: [{ messageId: 'throwTypeMismatch' }],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {null}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string}
           * @throws {number}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        errors: [{ messageId: 'throwTypeMismatch' }],
        options: [
          {
            preferUnionType: false,
            useBaseTypeOfLiteral: true,
          }
        ],
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {string}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string | number}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
        `,
        errors: [{ messageId: 'throwTypeMismatch' }],
        options: [{ useBaseTypeOfLiteral: true }],
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new RangeError());
              }
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new RangeError());
              }
            });
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {string | number}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
          /** @throws {string} */
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string | number}
           */
          function foo() {
            if (Math.random() > 0.5) {
              throw "lol";
            } else {
              throw 42;
            }
          }
          /** @throws {string | number} */
          function bar() {
            foo();
          }
        `,
        errors: [{
          messageId: 'throwTypeMismatch',
        }],
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {string | number | Error}
           */
          function foo() {
            const rand = Math.random();
            if (rand > 0.5) {
              throw "lol";
            } else if (rand < 0.2) {
              throw 42;
            } else {
              throw new Error();
            }
          }
          /**
           * @throws {string}
           * @throws {number}
           */
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string | number | Error}
           */
          function foo() {
            const rand = Math.random();
            if (rand > 0.5) {
              throw "lol";
            } else if (rand < 0.2) {
              throw 42;
            } else {
              throw new Error();
            }
          }
          /**
           * @throws {string}
           * @throws {number}
           * @throws {Error}
           */
          function bar() {
            foo();
          }
        `,
        errors: [{
          messageId: 'throwTypeMismatch',
        }],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError | RangeError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {SyntaxError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError | RangeError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           * @throws {Promise<RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          function bar() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            });
          }

          /**
           * @throws {SyntaxError | RangeError | TypeError}
           */
          async function baz() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              await bar();
            } else {
              throw new TypeError();
            }
          }
          baz().catch(() => {});
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          function bar() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            });
          }

          /**
           * @throws {Promise<SyntaxError | RangeError | TypeError>}
           */
          async function baz() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              await bar();
            } else {
              throw new TypeError();
            }
          }
          baz().catch(() => {});
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            return new Promise((resolve, reject) => {
              reject(new TypeError());
            });
          }

          /**
           * @throws {SyntaxError | RangeError | TypeError}
           */
          async function qux() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              bar();
            } else {
              await baz();
            }
          }
          qux().catch(() => {});
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            return new Promise((resolve, reject) => {
              reject(new TypeError());
            });
          }

          /**
           * @throws {Promise<SyntaxError | RangeError | TypeError>}
           */
          async function qux() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              bar();
            } else {
              await baz();
            }
          }
          qux().catch(() => {});
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<RangeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                reject(new TypeError());
              });
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                reject(new TypeError());
              });
            });
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<SyntaxError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                reject(new TypeError());
              });
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                reject(new TypeError());
              });
            });
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          function foo(resolve, reject) {
            reject(new RangeError());
          }

          /**
           * @throws {TypeError}
           */
          function bar() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          function baz() {
            return new Promise(foo)
              .then(bar);
          }
        `,
        output: `
          function foo(resolve, reject) {
            reject(new RangeError());
          }

          /**
           * @throws {TypeError}
           */
          function bar() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function baz() {
            return new Promise(foo)
              .then(bar);
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          function foo(resolve, reject) {
            reject(new RangeError());
          }

          /**
           * @throws {TypeError}
           */
          function bar() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          function baz() {
            return new Promise(foo)
              .catch(console.error)
              .then(bar);
          }
        `,
        output: `
          function foo(resolve, reject) {
            reject(new RangeError());
          }

          /**
           * @throws {TypeError}
           */
          function bar() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            return new Promise(foo)
              .catch(console.error)
              .then(bar);
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<SyntaxError>}
           */
          function foo() {
            const obj = {
              bar: (resolve, reject) => {
                reject(new RangeError());
              },
              /**
               * @throws {Promise<TypeError>}
               */
              baz: () => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              }
            };

            return new Promise(obj.bar)
              .then(obj.baz);
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const obj = {
              bar: (resolve, reject) => {
                reject(new RangeError());
              },
              /**
               * @throws {Promise<TypeError>}
               */
              baz: () => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              }
            };

            return new Promise(obj.bar)
              .then(obj.baz);
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function* g() {
            throw new TypeError();
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function f() {
            for (const x of g()) {}
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function f() {
            for (const x of g()) {}
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function f() {
            [...g()];
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function f() {
            [...g()];
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function f() {
            Array.from(g());
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function f() {
            Array.from(g());
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function* h() {
            yield* g();
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function* h() {
            yield* g();
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function h() {
            g().next();
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function* g() {
            throw new TypeError();
          }

          /**
           * @throws {TypeError}
           */
          function h() {
            g().next();
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<RangeError>}
           */
          async function* g() {
            throw new TypeError();
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          async function f() {
            for await (const x of g()) {}
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function f() {
            for await (const x of g()) {}
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          async function f() {
            await Array.fromAsync(g());
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function f() {
            await Array.fromAsync(g());
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          async function* h() {
            yield* g();
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function* h() {
            yield* g();
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          async function h() {
            await g().next();
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function* g() {
            throw new TypeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function h() {
            await g().next();
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          const foo = {
            /**
             * @throws {RangeError}
             */
            get bar() {
              throw new RangeError('baz');
            },
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            },
          };

          /**
           * @throws {TypeError}
           */
          function baz() {
            foo.bar;
          }

          /**
           * @throws {RangeError}
           */
          function qux() {
            foo.bar = 'quux';
          }
        `,
        output: `
          const foo = {
            /**
             * @throws {RangeError}
             */
            get bar() {
              throw new RangeError('baz');
            },
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            },
          };

          /**
           * @throws {RangeError}
           */
          function baz() {
            foo.bar;
          }

          /**
           * @throws {TypeError}
           */
          function qux() {
            foo.bar = 'quux';
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          class TrueGetterError extends Error {}
          class TrueSetterError extends Error {}
          class FalseGetterError extends Error {}
          class FalseSetterError extends Error {}

          function foo() {
            if (Math.random() > 0.5) {
              return {
                flag: true,
                /**
                 * @throws {TrueGetterError}
                 */
                get value() {
                  throw new TrueGetterError();
                },
                /**
                 * @throws {TrueSetterError}
                 */
                set value(v: any) {
                  throw new TrueSetterError();
                },
              } as const;
            } else {
              return {
                flag: false,
                /**
                 * @throws {FalseGetterError}
                 */
                get value() {
                  throw new FalseGetterError();
                },
                /**
                 * @throws {FalseSetterError}
                 */
                set value(v: any) {
                  throw new FalseSetterError();
                },
              } as const;
            }
          }

          /**
           * @throws {TrueGetterError}
           */
          function bar() {
            const result = foo();
            if (!result.flag) {
              result.value;
            }
          }

          /**
           * @throws {FalseGetterError}
           */
          function baz() {
            const result = foo();
            if (result.flag) {
              result.value;
            }
          }

          /**
           * @throws {TrueSetterError}
           */
          function qux() {
            const result = foo();
            if (!result.flag) {
              result.value = 42;
            }
          }

          /**
           * @throws {FalseSetterError}
           */
          function quux() {
            const result = foo();
            if (result.flag) {
              result.value = 42;
            }
          }
        `,
        output: `
          class TrueGetterError extends Error {}
          class TrueSetterError extends Error {}
          class FalseGetterError extends Error {}
          class FalseSetterError extends Error {}

          function foo() {
            if (Math.random() > 0.5) {
              return {
                flag: true,
                /**
                 * @throws {TrueGetterError}
                 */
                get value() {
                  throw new TrueGetterError();
                },
                /**
                 * @throws {TrueSetterError}
                 */
                set value(v: any) {
                  throw new TrueSetterError();
                },
              } as const;
            } else {
              return {
                flag: false,
                /**
                 * @throws {FalseGetterError}
                 */
                get value() {
                  throw new FalseGetterError();
                },
                /**
                 * @throws {FalseSetterError}
                 */
                set value(v: any) {
                  throw new FalseSetterError();
                },
              } as const;
            }
          }

          /**
           * @throws {FalseGetterError}
           */
          function bar() {
            const result = foo();
            if (!result.flag) {
              result.value;
            }
          }

          /**
           * @throws {TrueGetterError}
           */
          function baz() {
            const result = foo();
            if (result.flag) {
              result.value;
            }
          }

          /**
           * @throws {FalseSetterError}
           */
          function qux() {
            const result = foo();
            if (!result.flag) {
              result.value = 42;
            }
          }

          /**
           * @throws {TrueSetterError}
           */
          function quux() {
            const result = foo();
            if (result.flag) {
              result.value = 42;
            }
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
          { messageId: 'throwTypeMismatch' },
          { messageId: 'throwTypeMismatch' },
          { messageId: 'throwTypeMismatch' },
        ],
      },
    ],
  },
);

