const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-implicit-propagation');

// https://github.com/typescript-eslint/typescript-eslint/blob/main/docs/packages/Rule_Tester.mdx#type-aware-testing
const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts*'],
      },
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
      },
    ],
    invalid: [
      {
        code:
          '/**\n' +
          ' * @throws {Error}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  throw new Error("foo");\n' +
          '}\n' +
          'function bar() {\n' +
          '  foo();\n' +
          '}',
        output:
          '/**\n' +
          ' * @throws {Error}\n' +
          ' */\n' +
          'function foo() {\n' +
          '  throw new Error("foo");\n' +
          '}\n' +
          'function bar() {\n' +
          '  try { foo(); } catch {}\n' +
          '}',
        errors: 1,
      },
    ],
  },
);

