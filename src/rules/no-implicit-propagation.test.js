// @ts-check
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-implicit-propagation');

// https://github.com/typescript-eslint/typescript-eslint/blob/main/docs/packages/Rule_Tester.mdx#type-aware-testing
const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts*'],
      },
      JSDocParsingMode: 'all',
    },
  },
});

ruleTester.run(
  'no-implicit-propagation',
  rule,
  {
    valid: [
      {
        code: `
          /**
           * foo bar baz
           * @throws {string}
           */
          function foo() {
            throw "lol";
          }
          function bar() {
            try {
              foo();
            } catch {}
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {string}
           */
          const foo = () => {
            throw "lol";
          };
          const bar = () => {
            try {
              foo();
            } catch {}
          };
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {string}
           */
          function foo() {
            throw "lol";
          }
          /** @throws {string} */
          function bar() {
            foo();
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
          /** @throws {string | number} */
          function bar() {
            foo();
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
          /** @throws {number | string} */
          function bar() {
            foo();
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
          /**
           * @throws {string}
           * @throws {number}
           */
          function bar() {
            foo();
          }
        `,
      },
      {
        code: `
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
          const baz = () => {
            try {
              foo.bar;
            } catch {}
          };
        `,
      },
      {
        code: `
          const foo = {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            },
            /**
             * @param {number} value
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            },
          };
          /**
           * @throws {Error}
           * @throws {TypeError}
           */
          const baz = () => {
            foo.bar;
          };
        `,
      },
      {
        code: `
          const foo = {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            },
            /**
             * @param {number} value
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            },
          };
          /**
           * @throws {Error}
           * @throws {TypeError}
           */
          const baz = () => {
            foo.bar = 42;
          };
        `,
      },
      {
        code: `
          class Foo {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          const baz = () => {
            try {
              new Foo().bar;
            } catch {}
          };
        `,
      },
      {
        code: `
          class Foo {
            /**
             * @throws {SyntaxError}
             */
            get bar() {
              throw new SyntaxError('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          /** @throws {SyntaxError} */
          const baz = () => {
            new Foo().bar;
          };
        `,
      },
      {
        code: `
          class Foo {
            /**
             * @throws {SyntaxError}
             */
            get bar() {
              throw new SyntaxError('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          /** @throws {TypeError} */
          const baz = () => {
            new Foo().bar = 42;
          };
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error();
          }
          async function bar() {
            try {
              await foo();
            } catch {}
          }
        `,
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error();
          }
          /**
           * @throws {Promise<Error>}
           */
          async function bar() {
            await foo();
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          /**
           * foo bar baz
           * @throws {Error}
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
           * foo bar baz
           * @throws {Error}
           */
          function foo() {
            throw new Error('foo');
          }
          /**
           * @throws {Error}
           */
          function bar() {
            foo();
          }
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
        ],
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
          const bar = () => {
            foo();
          };
        `,
        output: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          const foo = () => {
            throw new Error('foo');
          };
          /**
           * @throws {Error}
           */
          const bar = () => {
            foo();
          };
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
        ],
      },
      {
        code: `
          const obj = {
            /** @throws {Error} */
            foo: () => {
              throw new Error('foo');
            },
          };
          const bar = () => {
            obj.foo();
          };
        `,
        output: `
          const obj = {
            /** @throws {Error} */
            foo: () => {
              throw new Error('foo');
            },
          };
          /**
           * @throws {Error}
           */
          const bar = () => {
            obj.foo();
          };
        `,
        errors: [{ messageId: 'implicitPropagation' }],
      },
      {
        code: `
          const obj = {
            /** @throws {Error} */
            foo: () => {
              try {
                throw new Error('foo');
              } finally {
                console.log('error');
              }
            },
          };
          const bar = () => {
            obj.foo();
          };
        `,
        output: `
          const obj = {
            /** @throws {Error} */
            foo: () => {
              try {
                throw new Error('foo');
              } finally {
                console.log('error');
              }
            },
          };
          /**
           * @throws {Error}
           */
          const bar = () => {
            obj.foo();
          };
        `,
        errors: [{ messageId: 'implicitPropagation' }],
      },
      {
        code: `
          class Foo {
            /** @throws {Error} */
            foo() {
              throw new Error('foo');
            }
          }
          const bar = () => {
            new Foo().foo();
          };
        `,
        output: `
          class Foo {
            /** @throws {Error} */
            foo() {
              throw new Error('foo');
            }
          }
          /**
           * @throws {Error}
           */
          const bar = () => {
            new Foo().foo();
          };
        `,
        errors: [{ messageId: 'implicitPropagation' }],
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
          function bar() {
            try {
              something();
            } catch {
              foo();
            }
          }
        `,
        output: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          function foo() {
            throw new Error('foo');
          }
          /**
           * @throws {Error}
           */
          function bar() {
            try {
              something();
            } catch {
              foo();
            }
          }
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
        ],
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
          function bar() {
            try {
              something();
            } finally {
              foo();
            }
          }
        `,
        output: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          function foo() {
            throw new Error('foo');
          }
          /**
           * @throws {Error}
           */
          function bar() {
            try {
              something();
            } finally {
              foo();
            }
          }
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
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
          const baz = () => {
            foo.bar = 42;
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
          /**
           * @throws {TypeError}
           */
          const baz = () => {
            foo.bar = 42;
          };
        `,
        errors: [
          { messageId: 'implicitPropagation' },
        ],
      },
      {
        code: `
          class Foo {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          const baz = () => {
            new Foo().bar = 42;
          };
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          /**
           * @throws {TypeError}
           */
          const baz = () => {
            new Foo().bar = 42;
          };
        `,
        errors: [
          { messageId: 'implicitPropagation' },
        ],
      },
      {
        code: `
          class Foo {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          const baz = () => {
            new Foo().bar;
          };
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            }
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            }
          };
          /**
           * @throws {Error}
           */
          const baz = () => {
            new Foo().bar;
          };
        `,
        errors: [
          { messageId: 'implicitPropagation' },
        ],
      },
      {
        code: `
          const egg = {
            get ham() {
              return {
                /**
                 * @throws {Error}
                 */
                get spam() {
                  throw new Error();
                },
              };
            }
          };

          const lol = () => {
            console.log(egg.ham.spam);
          };
          lol();
        `,
        output: `
          const egg = {
            get ham() {
              return {
                /**
                 * @throws {Error}
                 */
                get spam() {
                  throw new Error();
                },
              };
            }
          };

          /**
           * @throws {Error}
           */
          const lol = () => {
            console.log(egg.ham.spam);
          };
          lol();
        `,
        errors: [
          { messageId: 'implicitPropagation' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error();
          }
          async function bar() {
            await foo();
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error();
          }
          /**
           * @throws {Promise<Error>}
           */
          async function bar() {
            await foo();
          }
        `,
        errors: [
          { messageId: 'implicitPropagation' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return new Promise((_, r) => r(new Error()));
          }
          async function bar() {
            await foo();
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return new Promise((_, r) => r(new Error()));
          }
          /**
           * @throws {Promise<Error>}
           */
          async function bar() {
            await foo();
          }
        `,
        errors: [
          { messageId: 'implicitPropagation' },
        ],
      },
    ],
  },
);
