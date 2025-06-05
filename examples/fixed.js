/**
 * @throws {RangeError}
 */
function foo() {
  throw new RangeError();
}

/**
 * @throws {TypeError}
 */
function bar() {
  throw new TypeError();
}

/**
 * @throws {RangeError | TypeError}
 */
function baz() {
  if (Math.random() > 0.5) {
    foo();
  } else {
    bar();
  }
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

const egg = {
  get ham() {
    return {
      /**
       * @throws {Error}
       */
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
  /**
   * @throws {Error}
   */
  return function () {
    throw new Error();
  }
}
factory();

/**
 * @throws {Promise<Error>}
 */
function promised() {
  return new Promise((_, reject) => {
    reject(new Error());
  });
}
promised().catch(() => {});

/**
 * @param {string} path
 * @param {AbortController} controller
 * @throws {Promise<DOMException>}
 */
async function fetchAPI(path, controller) {
  return await fetch(path, {
    signal: controller.signal,
  });
}
const controller = new AbortController();
fetchAPI('/test', controller).catch(console.error);

export {};
