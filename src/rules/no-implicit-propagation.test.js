const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-implicit-propagation');

// https://github.com/typescript-eslint/typescript-eslint/blob/main/docs/packages/Rule_Tester.mdx#type-aware-testing
/** @type {import('@typescript-eslint/rule-tester/dist').RuleTester} */
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
      }
    ],
  },
);

