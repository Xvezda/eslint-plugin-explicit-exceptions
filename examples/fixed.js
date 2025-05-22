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

