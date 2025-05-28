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
      {
        code: `
          function foo() {
            new Promise((resolve, reject) => {
              reject(new Error());
            })
              .then(console.log)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new Error());
            });

            promise.catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            return new Promise(function (resolve, reject) {
              reject(new Error());
            })
              .then(console.log)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const callback = function (resolve, reject) {
              reject(new Error());
            };
            return new Promise(callback)
              .then(console.log)
              .catch(console.error);
          }
        `,
      },
      {
        code: `
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
      },
      {
        code: `
          /**
           * @throws {Promise<TypeError>}
           * @throws {Promise<RangeError>}
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
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .finally(() => {
                throw new Error();
              })
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              });

            return promise
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error)
              .then(() => {
                throw new TypeError();
              });

            return promise
              .catch(console.error);
          }
        `,
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .then(() => {
                throw new TypeError();
              })
              .catch(console.error)
          }
        `,
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then((resolve, reject) => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              })
              .catch(console.error)
          }
        `,
      },
      {
        code: `
          /**
           * @throws {TypeError}
           */
          const callback = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            const promise = Promise.resolve();

            return promise
              .then(callback)
              .catch(console.error);
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
      {
        code: `
          function factory() {
            return function () {
              throw new Error();
            }
          }
        `,
        output: `
          function factory() {
            /**
             * @throws {Error}
             */
            return function () {
              throw new Error();
            }
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function factory() {
            return () => {
              throw new Error();
            }
          }
        `,
        output: `
          function factory() {
            /**
             * @throws {Error}
             */
            return () => {
              throw new Error();
            }
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function factory() {
            function inner() {
              throw new Error();
            }
            return inner;
          }
        `,
        output: `
          function factory() {
            /**
             * @throws {Error}
             */
            function inner() {
              throw new Error();
            }
            return inner;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          async function foo() {
            throw new Error();
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          async function foo() {
            throw new Error();
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
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
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new SyntaxError());
              }
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError | SyntaxError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                reject(new SyntaxError());
              }
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new Error());
            });
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new Error());
            });
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const callback = (resolve, reject) => {
              reject(new Error());
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const callback = (resolve, reject) => {
              reject(new Error());
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function callback(resolve, reject) {
            reject(new Error());
          }
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          function callback(resolve, reject) {
            reject(new Error());
          }
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              throw new Error();
            });
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              throw new Error();
            });
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            /**
             * @throws {Error}
             */
            const callback = (resolve, reject) => {
              throw new Error();
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            /**
             * @throws {Error}
             */
            const callback = (resolve, reject) => {
              throw new Error();
            };
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          /**
           * @throws {Error}
           */
          function callback(resolve, reject) {
            throw new Error();
          }
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Error}
           */
          function callback(resolve, reject) {
            throw new Error();
          }
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                throw new SyntaxError();
              }
            });
            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError | SyntaxError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              if (Math.random() > 0.5) {
                reject(new TypeError());
              } else {
                throw new SyntaxError();
              }
            });
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function callback(resolve, reject) {
            if (Math.random() > 0.6) {
              reject(new TypeError());
            } else if (Math.random() > 0.3) {
              throw new SyntaxError();
            } else {
              reject(new RangeError());
            }
          }
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function callback(resolve, reject) {
            if (Math.random() > 0.6) {
              reject(new TypeError());
            } else if (Math.random() > 0.3) {
              throw new SyntaxError();
            } else {
              reject(new RangeError());
            }
          }
          /**
           * @throws {Promise<TypeError | RangeError | SyntaxError>}
           */
          function foo() {
            const promise = new Promise(callback);
            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .finally(() => {
                throw new Error();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.resolve()
              .finally(() => {
                throw new Error();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error)
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            return Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error)
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error);

            return promise
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                throw new Error();
              })
              .catch(console.error);

            return promise
              .then(() => {
                throw new TypeError();
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            return Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                reject(new TypeError());
              });
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                reject(new TypeError());
              });
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                throw new TypeError();
              });
            });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            return new Promise((resolve, reject) => {
              reject(new RangeError());
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                throw new TypeError();
              });
            });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });

            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = Promise.resolve()
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });

            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });

            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });

            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });

            return promise;
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            })
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });

            return promise;
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = Promise.resolve();

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<Error>}
           */
          function foo() {
            const promise = Promise.resolve();

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new Error());
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  reject(new TypeError());
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError | TypeError>}
           */
          function foo() {
            const promise = new Promise((resolve, reject) => {
              reject(new RangeError());
            });

            return promise
              .then(() => {
                return new Promise((resolve, reject) => {
                  throw new TypeError();
                });
              });
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const callback = (resolve, reject) => {
            throw new TypeError();
          };

          function foo() {
            const promise = Promise.resolve();

            return promise.then(callback);
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const callback = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {Promise<TypeError>}
           */
          function foo() {
            const promise = Promise.resolve();

            return promise.then(callback);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          const foo = (resolve, reject) => {
            throw new TypeError();
          };

          /**
           * @throws {RangeError}
           */
          const bar = (resolve, reject) => {
            throw new RangeError();
          };

          /**
           * @throws {Promise<TypeError | RangeError>}
           */
          function baz() {
            const promise = Promise.resolve();

            return promise
              .then(foo)
              .then(bar)
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
      {
        code: `
          function baz() {
            async function foo(resolve, reject) {
              throw new TypeError();
            }

            const bar = async (resolve, reject) => {
              throw new RangeError();
            };

            const promise = Promise.resolve();

            return promise
              .then(foo)
              .catch(console.error)
              .then(bar);
          }
        `,
        output: `
          /**
           * @throws {Promise<RangeError>}
           */
          function baz() {
            /**
             * @throws {Promise<TypeError>}
             */
            async function foo(resolve, reject) {
              throw new TypeError();
            }

            /**
             * @throws {Promise<RangeError>}
             */
            const bar = async (resolve, reject) => {
              throw new RangeError();
            };

            const promise = Promise.resolve();

            return promise
              .then(foo)
              .catch(console.error)
              .then(bar);
          }
        `,
        errors: [
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
          { messageId: 'missingThrowsTag' },
        ],
      },
    ],
  },
);
