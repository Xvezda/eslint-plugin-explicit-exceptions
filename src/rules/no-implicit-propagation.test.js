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
          function bar() {
            try {
              foo();
            } catch {}
          }
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
        ],
        options: [
          {
            tabLength: 2,
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
          function bar() {
            try {
              something();
            } catch {
              try {
                foo();
              } catch {}
            }
          }
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
        ],
        options: [
          {
            tabLength: 2,
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
          function bar() {
            try {
              something();
            } finally {
              try {
                foo();
              } catch {}
            }
          }
        `,
        errors: [
          {
            messageId: 'implicitPropagation',
          },
        ],
        options: [
          {
            tabLength: 2,
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
    ],
  },
);

