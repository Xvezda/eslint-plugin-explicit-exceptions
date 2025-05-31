# eslint-plugin-explicit-exceptions

[![NPM Version](https://img.shields.io/npm/v/eslint-plugin-explicit-exceptions)](https://www.npmjs.com/package/eslint-plugin-explicit-exceptions)
[![Test](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/actions/workflows/test.yml/badge.svg)](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/actions/workflows/test.yml)

https://github.com/user-attachments/assets/4a833442-b8a5-462f-abeb-a28bd0e5863f

Just as [Java’s throws keyword](https://dev.java/learn/exceptions/throwing/) does, enforcing the use of [JSDoc’s `@throws` tag](https://jsdoc.app/tags-throws) to explicitly specify which exceptions a function can throw to solve unpredictable propagation of exceptions happening which also known as a [JavaScript's "hidden exceptions"](https://www.youtube.com/watch?v=3iWoNJbGO2U).

## Features
- Reports and provides fixes for throwable functions that are not annotated with `@throws`.
- Reports and provides fixes for async functions and Promise rejections.
- Verifies that the exception types match the documented types.

## Examples
For functions that propagate exceptions to the caller because they didn’t handle exceptions, this plugin enforces the use of a `@throws` comment.
```javascript
// ❌ Error - no `@throws` tag
function foo() {
  throw new RangeError();
}

// ✅ OK - no exception propagation
function bar() {
  try {
    throw new TypeError();
  } catch {}
}

// ❌ Error
function baz() {
  maybeThrow();
}

// ✅ OK
/** @throws {Error} */
function qux() {
  maybeThrow();
}
```

It also leverages these comments for type checking, helping ensure that errors are handled safely.
```javascript
// ❌ Error - type mismatch
/** @throws {TypeError} */
function foo() {
  throw new RangeError();
}

// ✅ OK
/**
 * @throws {TypeError}
 * @throws {RangeError}
 */
function bar() {
  maybeThrowTypeError();
  maybeThrowRangeError();
}

// ✅ OK
/** @throws {number} */
function baz() {
  throw 42;
}

// ✅ OK
/**
 * @throws {"error"}
 */
function qux() {
  throw 'error';
}
```

For error classes, since TypeScript uses duck typing for type checking, this plugin treats inherited error classes as different types.
However, documenting a common parent class is permitted.
```javascript
// ✅ OK
/** @throws {RangeError | TypeError} */
function foo() {
  maybeThrowRangeError();
  maybeThrowTypeError();
}

// ✅ OK
/** @throws {Error} */
function bar() {
  maybeThrowRangeError();
  maybeThrowTypeError();
}
```

To clearly distinguish between a synchronous throw and an asynchronous promise rejection, this plugin requires that promise rejections be documented in the special form of `Promise<Error>`.
```javascript
/**
 * @throws {Promise<Error>}
 */
function foo() {
  return new Promise((resolve, reject) => reject(new Error()));
}

/**
 * @throws {Promise<TypeError | RangeError>}
 */
async function bar() {
  if (randomBool()) {
    throw new TypeError();  // This becomes promise rejection
  } else {
    return maybeThrowRangeError();
  }
}
```
For more examples, check out [examples](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/tree/master/examples) directory and rules below.

## Rules
 - [`no-implicit-propagation`](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/no-implicit-propagation.md)
 - [`no-undocumented-throws`](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/no-undocumented-throws.md)
 - [`no-unhandled-rejection`](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/no-unhandled-rejection.md)
 - [`check-throws-tag-type`](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/check-throws-tag-type.md)

## Usage

Install dependencies
```sh
# https://typescript-eslint.io/getting-started/#step-1-installation
npm install --save-dev eslint @eslint/js typescript typescript-eslint
```

Install plugin
```
npm install --save-dev eslint-plugin-explicit-exceptions
```

Create `eslint.config.mjs`

```javascript
// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import explicitExceptionsLint from 'eslint-plugin-explicit-exceptions';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  explicitExceptionsLint.configs.recommendTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```
Check out [`typescript-eslint`](https://typescript-eslint.io/getting-started/) for more information if you having an issue with configuring.

## License
[MIT License](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/LICENSE)
