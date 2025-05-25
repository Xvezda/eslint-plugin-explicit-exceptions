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

const egg = {
  get ham() {
    return {
      get spam() {
        throw new Error();
      },
    };
  }
};

const lol = () => {
  console.log(egg.ham.spam);
};
lol();

function factory() {
  return function () {
    throw new Error();
  }
}
factory();
