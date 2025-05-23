// @ts-check
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
          function foo() {
            try {
              throw new Error('foo');
            } catch (e) {}
          }
        `,
      },
      {
        code: `
          function foo() {
            try {
              try {
                if (true) {
                  throw new Error('foo');
                }
              } finally {}
            } catch (e) {}
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
           * foo bar baz
           * @throws {Error}
           */
          function foo() {
            {
              throw new Error('foo');
            }
          }
        `,
      },
      {
        code: `
          /**
           * foo bar baz
           * @throws {Error}
           */
          const foo = () => {
            throw new Error('foo');
          };
        `,
      },
      {
        code: `
          class Foo {
            /**
             * @throws {Error}
             */
            bar() {
              throw new Error('baz');
            }
          }
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: function () {
              throw new Error('foo');
            },
          };
        `,
      },
      {
        code: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: () => {
              throw new Error('foo');
            },
          };
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
            try {
              throw new Error("bar");
            } finally {
              console.log("baz");
            }
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            try {
              throw new Error("bar");
            } finally {
              console.log("baz");
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          function foo() {
            try {
              if (true) {
                throw new Error("bar");
              }
            } finally {
              console.log("baz");
            }
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            try {
              if (true) {
                throw new Error("bar");
              }
            } finally {
              console.log("baz");
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          function foo() {
            try {
              throw new Error("foo");
            } finally {
              console.log("bar");
            }
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function foo() {
            try {
              throw new Error("foo");
            } finally {
              console.log("bar");
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const foo = () => {
            throw new Error('foo');
          };
        `,
        output: `
          /**
           * @throws {Error}
           */
          const foo = () => {
            throw new Error('foo');
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const obj = {
            foo: function () {
              throw new Error('foo');
            },
          };
        `,
        output: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: function () {
              throw new Error('foo');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const obj = {
            foo: () => {
              throw new Error('foo');
            },
          };
        `,
        output: `
          const obj = {
            /**
             * @throws {Error}
             */
            foo: () => {
              throw new Error('foo');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const { foo, bar } = {
            foo: function () {},
            bar: () => {
              throw new Error('baz');
            },
          };
        `,
        output: `
          const { foo, bar } = {
            foo: function () {},
            /**
             * @throws {Error}
             */
            bar: () => {
              throw new Error('baz');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          const name = 'foo';
          const obj = {
            [name]: () => {
              throw new Error('foo');
            },
          };
        `,
        output: `
          const name = 'foo';
          const obj = {
            /**
             * @throws {Error}
             */
            [name]: () => {
              throw new Error('foo');
            },
          };
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          class Foo {
            bar() {
              throw new Error('baz');
            }
          }
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            bar() {
              throw new Error('baz');
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          class Foo {
            bar = () => {
              throw new Error('baz');
            }
          }
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            bar = () => {
              throw new Error('baz');
            }
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
      {
        code: `
          class Foo {
            static bar() {
              throw new Error('baz');
            }
          }
        `,
        output: `
          class Foo {
            /**
             * @throws {Error}
             */
            static bar() {
              throw new Error('baz');
            }
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
      {
        code: `
          const foo = {
            get bar() {
              throw new Error('baz');
            },
            set bar(value) {
              throw new TypeError('baz');
            },
          };
        `,
        output: `
          const foo = {
            /**
             * @throws {Error}
             */
            get bar() {
              throw new Error('baz');
            },
            /**
             * @throws {TypeError}
             */
            set bar(value) {
              throw new TypeError('baz');
            },
          };
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
    ],
  },
);
