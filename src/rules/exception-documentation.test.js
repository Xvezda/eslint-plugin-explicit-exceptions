// @ts-ignore
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./exception-documentation');

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
  'exception-documentation',
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
    ],
    invalid: [
      {
        code:
          'function foo() {\n' +
          '  throw new Error("foo");\n' +
          '}',
        output:
          '/**\n' +
          ' * @throws {Error}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  throw new Error("foo");\n' +
          '}',
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code:
          'function foo() {\n' +
          '  throw "lol";\n' +
          '}',
        output:
          '/**\n' +
          ' * @throws {string}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  throw "lol";\n' +
          '}',
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code:
          '/**\n' +
          ' * foo bar baz\n' +
          ' *\n' +
          ' * @throws {number}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  throw "lol";\n' +
          '}',
        output:
          '/**\n' +
          ' * foo bar baz\n' +
          ' *\n' +
          ' * @throws {string}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  throw "lol";\n' +
          '}',
        errors: [{ messageId: 'throwTypeMismatch' }],
      },
      {
        code:
          '/**\n' +
          ' * foo bar baz\n' +
          ' *\n' +
          ' * @throws {string}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  if (Math.random() > 0.5) {\n' +
          '    throw "lol";\n' +
          '  } else {\n' +
          '    throw 42;\n' +
          '  }\n' +
          '}',
        output:
          '/**\n' +
          ' * foo bar baz\n' +
          ' *\n' +
          ' * @throws {string|number}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  if (Math.random() > 0.5) {\n' +
          '    throw "lol";\n' +
          '  } else {\n' +
          '    throw 42;\n' +
          '  }\n' +
          '}',
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
