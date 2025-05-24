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

class Fizz {
  buzz() {
    throw new Error();
  }
}
new Fizz().buzz();
