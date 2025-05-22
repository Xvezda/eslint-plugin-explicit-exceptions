function foo() {
  throw new Error();
}

function bar() {
  foo();
}
bar();

function baz() {
  foo();
}
baz();
