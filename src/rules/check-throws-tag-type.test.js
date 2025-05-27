// @ts-check
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./check-throws-tag-type');

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
  'check-throws-tag-type',
  rule,
  {
    valid: [
      {
        code: `
          /** @throws {"lol" | 42} */
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
          /** @throws {string | 42} */
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
    ],
    invalid: [
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {null}
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
        options: [{ useBaseTypeOfLiteral: true }],
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
        options: [{ useBaseTypeOfLiteral: true }],
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new Error());
            });
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new RangeError());
              }
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new RangeError());
              }
            });
          }
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
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
          /** @throws {string} */
          function bar() {
            foo();
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
          /** @throws {string | number} */
          function bar() {
            foo();
          }
        `,
        errors: [{
          messageId: 'throwTypeMismatch',
        }],
      },
      {
        code: `
          /**
           * foo bar baz
           *
           * @throws {string | number | Error}
           */
          function foo() {
            const rand = Math.random();
            if (rand > 0.5) {
              throw "lol";
            } else if (rand < 0.2) {
              throw 42;
            } else {
              throw new Error();
            }
          }
          /**
           * @throws {string}
           * @throws {number}
           */
          function bar() {
            foo();
          }
        `,
        output: `
          /**
           * foo bar baz
           *
           * @throws {string | number | Error}
           */
          function foo() {
            const rand = Math.random();
            if (rand > 0.5) {
              throw "lol";
            } else if (rand < 0.2) {
              throw 42;
            } else {
              throw new Error();
            }
          }
          /**
           * @throws {string}
           * @throws {number}
           * @throws {Error}
           */
          function bar() {
            foo();
          }
        `,
        errors: [{
          messageId: 'throwTypeMismatch',
        }],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError | RangeError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {SyntaxError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError | RangeError}
           */
          function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {TypeError}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          async function foo() {
            throw new TypeError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          async function baz() {
            if (Math.random() > 0.5) {
              await foo();
            } else {
              bar();
            }
          }
          baz();
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          function bar() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            });
          }

          /**
           * @throws {SyntaxError | RangeError | TypeError}
           */
          async function baz() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              await bar();
            } else {
              throw new TypeError();
            }
          }
          baz().catch(() => {});
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {Promise<RangeError>}
           */
          function bar() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            });
          }

          /**
           * @throws {Promise<SyntaxError | RangeError | TypeError>}
           */
          async function baz() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              await bar();
            } else {
              throw new TypeError();
            }
          }
          baz().catch(() => {});
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
      {
        code: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            return new Promise((resolve, reject) => {
              reject(new TypeError());
            });
          }

          /**
           * @throws {SyntaxError | RangeError | TypeError}
           */
          async function qux() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              bar();
            } else {
              await baz();
            }
          }
          qux().catch(() => {});
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo() {
            throw new SyntaxError();
          }

          /**
           * @throws {RangeError}
           */
          function bar() {
            throw new RangeError();
          }

          /**
           * @throws {Promise<TypeError>}
           */
          function baz() {
            return new Promise((resolve, reject) => {
              reject(new TypeError());
            });
          }

          /**
           * @throws {Promise<SyntaxError | RangeError | TypeError>}
           */
          async function qux() {
            if (Math.random() > 0.6) {
              foo();
            } else if (Math.random() > 0.3) {
              bar();
            } else {
              await baz();
            }
          }
          qux().catch(() => {});
        `,
        errors: [
          { messageId: 'throwTypeMismatch' },
        ],
      },
    ],
  },
);

