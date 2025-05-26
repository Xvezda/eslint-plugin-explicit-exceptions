// @ts-check
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-unhandled-rejection');

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
  'no-unhandled-rejection',
  rule,
  {
    valid: [
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          function bar() {
            foo().catch(() => {});
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          function bar() {
            foo();
          }
        `,
        errors: [{ messageId: 'unhandledRejection' }],
      },
    ],
  },
);
