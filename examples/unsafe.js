function foo() {
  throw new RangeError();
}

function bar() {
  throw new TypeError();
}

function baz() {
  if (Math.random() > 0.5) {
    foo();
  } else {
    bar();
  }
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

/**
 * @throws {Error}
 */
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

function promised() {
  return new Promise((_, reject) => {
    reject(new Error());
  });
}
promised().catch(() => {});


export {};
