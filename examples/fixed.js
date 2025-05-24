/**
 * @throws {Error}
 */
function foo() {
  throw new Error();
}

function bar() {
  try {
    foo();
  } catch {}
}
bar();

/** @throws {Error} */
function baz() {
  foo();
}
baz();

class Fizz {
  /**
   * @throws {Error}
   */
  buzz() {
    throw new Error();
  }
}
new Fizz().buzz();
