function foo() {
  throw new Error();
}

function bar() {
  foo();
}
bar();
