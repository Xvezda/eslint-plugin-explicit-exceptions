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
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          async function bar() {
            try {
              await foo()
            } catch {}
          }
          await bar();
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
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          async function bar() {
            try {
              foo()
            } catch {}
          }
          await bar();
        `,
        errors: [{ messageId: 'unhandledRejection' }],
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          async function bar() {
            try {
            } catch {
              await foo()
            }
          }
          await bar();
        `,
        errors: [{ messageId: 'unhandledRejection' }],
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          async function bar() {
            try {
            } finally {
              await foo()
            }
          }
          await bar();
        `,
        errors: [{ messageId: 'unhandledRejection' }],
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          async function bar() {
            try {
            } catch (e) {
              console.error(e);
            } finally {
              await foo()
            }
          }
          await bar();
        `,
        errors: [{ messageId: 'unhandledRejection' }],
      },
      {
        code: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.reject(new Error());
          }

          async function bar() {
            try {
            } catch {
              try {
              } catch {
                await foo()
              }
            }
          }
          await bar();
        `,
        errors: [{ messageId: 'unhandledRejection' }],
      },
    ],
  },
);
