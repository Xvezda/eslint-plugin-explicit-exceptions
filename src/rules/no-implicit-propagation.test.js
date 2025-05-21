const test = require('ava');
const AvaRuleTester = require('eslint-ava-rule-tester').default;
const rule = require('./no-implicit-propagation');

const ruleTester = new AvaRuleTester(test);

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
          '  try {\n' +
          '    foo();\n' +
          '  } catch {}\n' +
          '}',
        errors: 1,
      },
    ],
  },
);

