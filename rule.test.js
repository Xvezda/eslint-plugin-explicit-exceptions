const { RuleTester } = require('eslint');
const rule = require('./rule');

const ruleTester = new RuleTester({});

ruleTester.run(
  'enforce-foo-bar',
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
      {
        code:
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
          '  try {\n' +
          '    foo();\n' +
          '  } catch {}\n' +
          '}',
        errors: 1,
      },
    ],
  },
);
console.log('Tests completed successfully.');
