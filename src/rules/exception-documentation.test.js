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
        errors: 1,
      },
    ],
  },
);
