// @ts-check
const path = require('node:path');
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('../../src/rules/no-undocumented-throws');

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
  'no-undocumented-throws',
  rule,
  {
    valid: [
      {
        code: `
          /**
           * @throws
           */
          function foo() {
            throw new Error('foo');
          }
        `,
      },
      {
        code: `
          /**
           * @throws
           */
          function foo() {
            throw new Error('foo');
          }

          /**
           * @throws
           */
          function bar() {
            foo();
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function foo() {
            throw new Error('foo');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function foo() {
            throw new TypeError('foo');
          }
        `,
      },
      {
        code: `
          function foo() {
            try {
              throw new Error('foo');
            } catch (e) {}
          }
        `,
      },
      {
        code: `
          function foo() {
            try {
              try {
                if (true) {
                  throw new Error('foo');
                }
              } finally {}
            } catch (e) {}
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          function foo() {
            throw new Error('foo');
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          function foo() {
            {
              throw new Error('foo');
            }
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          const foo = () => {
            throw new Error('foo');
          };
        `,
      },
      {
        code: `
          class Foo {
            /**
             * @throws {Error}
             */
            bar() {
              throw new Error('baz');
            }
          }
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: function () {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: () => {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Error}
             */
            'foo'() {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Error}
             */
            ['foo']: () => {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const name = 'foo';
          const obj = {
            /**
             * @throws {Error}
             */
            [name]: () => {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const name = 'foo';
          const obj = {
            /**
             * @throws {Error}
             */
            [name]: function () {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          /**
           * @throws {"lol"}
           */
          function foo() {
            throw "lol";
          }
        `,
      },
      {
        code: `
          /**
           * @throws {string}
           */
          function foo() {
            throw "lol";
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error('foo');
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Promise<Error>}
           */
          async function foo() {
            {
              throw new Error('foo');
            }
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Promise<Error>}
           */
          const foo = async () => {
            throw new Error('foo');
          };
        `,
      },
      {
        code: `
          class Foo {
            /**
             * @throws {Promise<Error>}
             */
            async bar() {
              throw new Error('baz');
            }
          }
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Promise<Error>}
             */
            foo: async function () {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Promise<Error>}
             */
            foo: async () => {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Promise<Error>}
             */
            async 'foo'() {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Promise<Error>}
             */
            ['foo']: async () => {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const name = 'foo';
          const obj = {
            /**
             * @throws {Promise<Error>}
             */
            [name]: async () => {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const name = 'foo';
          const obj = {
            /**
             * @throws {Promise<Error>}
             */
            async [name]: function () {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<"lol">}
           */
          async function foo() {
            throw "lol";
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<string>}
           */
          async function foo() {
            throw "lol";
          }
        `,
      },
      {
        code: `
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
          /**
           * foo bar baz
           *
           * @throws {number | string}
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
          /**
           * foo bar baz
           *
           * @exception {string}
           * @exception {number}
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
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            })
              .then(console.log)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new Error());
            });

            return promise.catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            return new Promise(function (resolve, reject) {
              reject(new Error());
            })
              .then(console.log)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const callback = function (resolve, reject) {
              reject(new Error());
            };
            return new Promise(callback)
              .then(console.log)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
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
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           * @throws {Promise<RangeError>}
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
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .finally(() => {
                throw new Error();
              })
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              });

            return promise
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error)
              .then(() => {
                throw new TypeError();
              });

            return promise
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .then(() => {
                throw new TypeError();
              })
              .catch(console.error)
          }
        `,
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then((resolve, reject) => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              })
              .catch(console.error)
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          const callback = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            const promise = Promise.resolve();

            return promise
              .then(callback)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          /**
           * @throws {SyntaxErreor}
           * @throws {Promise<TypeError | RangeError>}
           */
          function foo() {
            const promise = Promise.resolve();

            if (Math.random() > 0.6) {
              promise.then(() => {
                throw new TypeError();
              });
            } else if (Math.random() > 0.3) {
              throw new SyntaxError();
            } else {
              promise.finally(() => {
                throw new RangeError();
              });
            }
            return promise;
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<RangeError>}
           * @throws {SyntaxError}
           */
          function foo() {
            const promise = Promise.resolve();

            if (Math.random() > 0.5) {
              try {
                await promise.then(() => {
                  throw new TypeError();
                });
              } catch {}
            } else if (Math.random() > 0.3) {
              try {
                promise.finally(() => {
                  throw new RangeError();
                });
              } catch {
                throw new SyntaxError();
              }
            }
            return promise;
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           * @throws {Error}
           */
          function foo() {
            const promise = Promise.resolve();

            if (Math.random() > 0.5) {
              try {
                await promise.then(() => {
                  throw new TypeError();
                });
              } catch {}
            } else if (Math.random() > 0.3) {
              try {
                promise.finally(() => {
                  throw new RangeError();
                });
              } catch {
                throw new SyntaxError();
              }
            }
            return promise;
          }
        `,
      },
      {
        code: `
          function foo() {
            // Not returned promise should be reported as unhandled rejection rule
            new Promise((resolve, reject) => {
              reject(new Error());
            })
              .then(console.log);
          }
        `,
      },
      {
        code: `
          const obj = {
            foo: () => {
              new Promise((resolve, reject) => {
                reject(new Error());
              })
                .then(console.log);
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            foo: () => {
              return new Promise((resolve, reject) => {
                reject(new Error());
              })
                .then(console.log)
                .catch(console.error);
            },
          };
        `,
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          function foo() {
            return Promise.reject(new Error())
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          function foo() {
            return Promise.reject(new Error())
              .then(console.log, console.error);
          }
        `,
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          function foo() {
            // no return
            Promise.reject(new Error());
          }
        `,
      },
      {
        code: `
          /**
           * @throws
           */
          function* g() {
            throw new Error();
          }
        `,
      },
      {
        code: `
          /**
           * @throws
           */
          function* g() {
            throw new Error();
          }

          // Generator does not throws directly
          function f() {
            g();
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          function foo() {
            throw new Error("foo");
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            throw new Error("foo");
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /**
           * @throws
           */
          function bar() {
            foo();
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          function foo() {
            try {
              throw new Error("bar");
            } finally {
              console.log("baz");
            }
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            try {
              throw new Error("bar");
            } finally {
              console.log("baz");
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          function foo() {
            try {
              if (true) {
                throw new Error("bar");
              }
            } finally {
              console.log("baz");
            }
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            try {
              if (true) {
                throw new Error("bar");
              }
            } finally {
              console.log("baz");
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          function foo() {
            try {
              throw new Error("foo");
            } finally {
              console.log("bar");
            }
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            try {
              throw new Error("foo");
            } finally {
              console.log("bar");
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const foo = () => {
            throw new Error('foo');
          };
        `,
        output: `
          /**
           * @throws {Error}
           */
          const foo = () => {
            throw new Error('foo');
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const obj = {
            foo: function () {
              throw new Error('foo');
            },
          };
        `,
        output: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: function () {
              throw new Error('foo');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const obj = {
            foo: () => {
              throw new Error('foo');
            },
          };
        `,
        output: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: () => {
              throw new Error('foo');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const { foo, bar } = {
            foo: function () {},
            bar: () => {
              throw new Error('baz');
            },
          };
        `,
        output: `
          const { foo, bar } = {
            foo: function () {},
            /**
             * @throws {Error}
             */
            bar: () => {
              throw new Error('baz');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const name = 'foo';
          const obj = {
            [name]: () => {
              throw new Error('foo');
            },
          };
        `,
        output: `
          const name = 'foo';
          const obj = {
            /**
             * @throws {Error}
             */
            [name]: () => {
              throw new Error('foo');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          class Foo {
            bar() {
              throw new Error('baz');
            }
          }
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            bar() {
              throw new Error('baz');
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          class Foo {
            bar = () => {
              throw new Error('baz');
            }
          }
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            bar = () => {
              throw new Error('baz');
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          class Foo {
            static bar() {
              throw new Error('baz');
            }
          }
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            static bar() {
              throw new Error('baz');
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          function foo() {
            throw "lol";
          }
        `,
        output: `
          /**
           * @throws {string}
           */
          function foo() {
            throw "lol";
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
        options: [{ useBaseTypeOfLiteral: true }],
      },
      {
        code: `
          const foo = {
            get bar() {
              throw new Error('baz');
            },
            set bar(value) {
              throw new TypeError('baz');
            },
          };
        `,
        output: `
          const foo = {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            },
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            },
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function factory() {
            return function () {
              throw new Error();
            }
          }
        `,
        output: `
          function factory() {
            /**
             * @throws {Error}
             */
            return function () {
              throw new Error();
            }
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function factory() {
            return () => {
              throw new Error();
            }
          }
        `,
        output: `
          function factory() {
            /**
             * @throws {Error}
             */
            return () => {
              throw new Error();
            }
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function factory() {
            function inner() {
              throw new Error();
            }
            return inner;
          }
        `,
        output: `
          function factory() {
            /**
             * @throws {Error}
             */
            function inner() {
              throw new Error();
            }
            return inner;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          async function foo() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
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
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = () => {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          };
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          const foo = () => {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new SyntaxError());
              }
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError | SyntaxError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new SyntaxError());
              }
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new Error());
            });
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new Error());
            });
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const callback = (resolve, reject) => {
              reject(new Error());
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const callback = (resolve, reject) => {
              reject(new Error());
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function callback(resolve, reject) {
            reject(new Error());
          }
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          function callback(resolve, reject) {
            reject(new Error());
          }
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              throw new Error();
            });
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              throw new Error();
            });
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            /**
             * @throws {Error}
             */
            const callback = (resolve, reject) => {
              throw new Error();
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            /**
             * @throws {Error}
             */
            const callback = (resolve, reject) => {
              throw new Error();
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function callback(resolve, reject) {
            throw new Error();
          }
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function callback(resolve, reject) {
            throw new Error();
          }
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                throw new SyntaxError();
              }
            });
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError | SyntaxError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                throw new SyntaxError();
              }
            });
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function callback(resolve, reject) {
            if (Math.random() > 0.6) {
              reject(new TypeError());
            } else if (Math.random() > 0.3) {
              throw new SyntaxError();
            } else {
              reject(new RangeError());
            }
          }
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function callback(resolve, reject) {
            if (Math.random() > 0.6) {
              reject(new TypeError());
            } else if (Math.random() > 0.3) {
              throw new SyntaxError();
            } else {
              reject(new RangeError());
            }
          }
          /**
           * @throws {Promise<TypeError | RangeError | SyntaxError>}
           */
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .finally(() => {
                throw new Error();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.resolve()
              .finally(() => {
                throw new Error();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error)
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error)
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error);

            return promise
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error);

            return promise
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
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
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                throw new TypeError();
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
                throw new TypeError();
              });
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });

            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });

            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });

            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });

            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });

            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });

            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve();

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = Promise.resolve();

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
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
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const callback = (resolve, reject) => {
            throw new TypeError();
          };

          function foo() {
            const promise = Promise.resolve();

            return promise.then(callback);
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const callback = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            const promise = Promise.resolve();

            return promise.then(callback);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {RangeError}
           */
          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {RangeError}
           */
          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /**
           * @throws {Promise<TypeError>}
           * @throws {Promise<RangeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /**
           * foobar
           */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {RangeError}
           */
          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /**
           * foobar
           * @throws {Promise<TypeError>}
           * @throws {Promise<RangeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /** foobar */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {RangeError}
           */
          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /**
           * foobar
           * @throws {Promise<TypeError>}
           * @throws {Promise<RangeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          function baz() {
            async function foo(resolve, reject) {
              throw new TypeError();
            }

            const bar = async (resolve, reject) => {
              throw new RangeError();
            };

            const promise = Promise.resolve();

            return promise
              .then(foo)
              .catch(console.error)
              .then(bar);
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError>}
           */
          function baz() {
            /**
             * @throws {Promise<TypeError>}
             */
            async function foo(resolve, reject) {
              throw new TypeError();
            }

            /**
             * @throws {Promise<RangeError>}
             */
            const bar = async (resolve, reject) => {
              throw new RangeError();
            };

            const promise = Promise.resolve();

            return promise
              .then(foo)
              .catch(console.error)
              .then(bar);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = {
            bar: (resolve, reject) => {
              throw new TypeError();
            },
          };

          function baz() {
            const promise = Promise.resolve();

            return promise.then(foo.bar);
          }
        `,
        output: `
          const foo = {
            /**
             * @throws {TypeError}
             */
            bar: (resolve, reject) => {
              throw new TypeError();
            },
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise.then(foo.bar);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = {
            bar: {
              baz: (resolve, reject) => {
                throw new TypeError();
              },
            },
          };

          function baz() {
            const promise = Promise.resolve();

            return promise.then(foo.bar.baz);
          }
        `,
        output: `
          const foo = {
            bar: {
              /**
               * @throws {TypeError}
               */
              baz: (resolve, reject) => {
                throw new TypeError();
              },
            },
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise.then(foo.bar.baz);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = {
            get bar() {
              return {
                baz: (resolve, reject) => {
                  throw new TypeError();
                },
              };
            },
          };

          function baz() {
            const promise = Promise.resolve();

            return promise.then(foo.bar.baz);
          }
        `,
        output: `
          const foo = {
            get bar() {
              return {
                /**
                 * @throws {TypeError}
                 */
                baz: (resolve, reject) => {
                  throw new TypeError();
                },
              };
            },
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise.then(foo.bar.baz);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export function foo() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          export function foo() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export default function foo() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          export default function foo() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export async function foo() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export async function foo() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export default async function foo() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export default async function foo() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export default function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export default function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export const foo = function () {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Error}
           */
          export const foo = function () {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export let foo = function () {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Error}
           */
          export let foo = function () {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export const foo = () => {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Error}
           */
          export const foo = () => {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export let foo = () => {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Error}
           */
          export let foo = () => {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export const foo = async function () {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export const foo = async function () {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export let foo = async function () {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export let foo = async function () {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export const foo = async () => {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export const foo = async () => {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          export let foo = async () => {
            throw new Error();
          };
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          export let foo = async () => {
            throw new Error();
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          function foo() {
            return Promise.reject(new Error());
          }
        `,
        output: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * @throws {Promise<unknown>}
           */
          function foo() {
            return Promise.reject(new Error());
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          function foo() {
            return Promise.reject(new Error())
              .then(console.log);
          }
        `,
        output: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * @throws {Promise<unknown>}
           */
          function foo() {
            return Promise.reject(new Error())
              .then(console.log);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * @param {any} value
           */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        output: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * @param {any} value
           * @throws {Promise<unknown>}
           */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /** @param {any} value */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        output: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * @param {any} value
           * @throws {Promise<unknown>}
           */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /** @param {any} value
           */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        output: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * @param {any} value
           * @throws {Promise<unknown>}
           */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /** foo */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        output: `
          interface PromiseConstructor {
            /**
             * @throws {Promise<unknown>}
             */
            reject(reason?: any): Promise<unknown>;
          }

          /**
           * foo
           * @throws {Promise<unknown>}
           */
          function foo(value) {
            return Promise.reject(value)
              .then(console.log);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /** foo */
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /**
           * foo
           * @throws
           */
          function bar() {
            foo();
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /** foo
           */
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /**
           * foo
           * @throws
           */
          function bar() {
            foo();
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /**
           * @deprecated
           */
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          /**
           * @deprecated
           * @throws
           */
          function bar() {
            foo();
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          // blah blah
          // haha
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * @throws Will throw something
           */
          function foo() {
            throw new Error('foo');
          }

          // blah blah
          // haha
          /**
           * @throws
           */
          function bar() {
            foo();
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          /**
           * @param {number} value
           */
          function foo(value) {
            new ArrayBuffer(value);
          }
        `,
        output: `
          /**
           * @param {number} value
           * @throws {RangeError}
           */
          function foo(value) {
            new ArrayBuffer(value);
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          /**
           * foobar
           */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        output: `
          /**
           * foobar
           * @throws {RangeError}
           * @throws {Promise<TypeError>}
           * @throws {Promise<SyntaxError>}
           */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          /** foobar */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        output: `
          /**
           * foobar
           * @throws {RangeError}
           * @throws {Promise<TypeError>}
           * @throws {Promise<SyntaxError>}
           */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          /**
           * foobar
           * @param {any} value
           */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        output: `
          /**
           * foobar
           * @param {any} value
           * @throws {RangeError}
           * @throws {Promise<TypeError>}
           * @throws {Promise<SyntaxError>}
           */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        output: `
          /**
           * @throws {RangeError}
           * @throws {Promise<TypeError>}
           * @throws {Promise<SyntaxError>}
           */
          function foo(value) {
            if (Math.random() > 0.5) {
              throw new RangeError();
            } else {
              return new Promise((resolve, reject) => {
                if (Math.random() > 0.6) {
                  reject(new TypeError());
                } else if (Math.random() > 0.3) {
                  reject(new SyntaxError());
                } else {
                  resolve(true);
                }
              });
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
        options: [{ preferUnionType: false }],
      },
      {
        code: `
          function* g() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function* g() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function* g() {
            throw new Error();
          }

          function f() {
            for (const x of g()) {}
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function* g() {
            throw new Error();
          }

          /**
           * @throws {Error}
           */
          function f() {
            for (const x of g()) {}
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function* g() {
            throw new Error();
          }

          function f() {
            [...g()];
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function* g() {
            throw new Error();
          }

          /**
           * @throws {Error}
           */
          function f() {
            [...g()];
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
    ],
  },
);
