const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-undocumented-throws');

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
  'no-undocumented-throws',
  rule,
  {
    valid: [
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
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {number}
           */
          function foo() {
            throw "lol";
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string}
           */
          function foo() {
            throw "lol";
          }
        `,
        errors: [{ messageId: 'throwTypeMismatch' }],
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
        options: [
          {
            useBaseTypeOfLiteral: true,
          },
        ],
      },
    ],
  },
);
