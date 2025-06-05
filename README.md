# eslint-plugin-explicit-exceptions

[![NPM Version](https://img.shields.io/npm/v/eslint-plugin-explicit-exceptions)](https://www.npmjs.com/package/eslint-plugin-explicit-exceptions)
[![Coverage](https://raw.githubusercontent.com/Xvezda/eslint-plugin-explicit-exceptions/refs/heads/_meta/coverage.svg)](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/actions/workflows/test.yml)
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
 - [`no-undocumented-throws`](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/docs/rules/no-undocumented-throws.md)
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

> [!WARNING]
> > These packages are experimental.
> 
> Install custom types for better built-in, libraries lint support.
> ```sh
> # For @types/*, i.e. @types/node
> npm install --save-dev @types-with-exceptions/node
> # For built-in lib replacement
> npm install --save-dev @types-with-exceptions/lib
> ```
> `tsconfig.json`
> ```diff
>  {
>     // ...
> +   "typeRoots": [
> +     "node_modules/@types",
> +     "node_modules/@types-with-exceptions"
> +   ],
> +   "libReplacement": true,
>     // ...
>  }
> ```
> Visit https://github.com/Xvezda/types-with-exceptions to see more.

Create `eslint.config.mjs`

```javascript
// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import explicitExceptionsLint from 'eslint-plugin-explicit-exceptions';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  explicitExceptionsLint.configs.recommendedTypeChecked,
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

For legacy, `.eslintrc.json`

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:eslint-plugin-explicit-exceptions/recommended-type-checked-legacy"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "parserOptions": {
    "projectService": true
  },
  "root": true
}
```
This project uses [TypeScript](https://www.typescriptlang.org/) and [typescript-eslint](https://typescript-eslint.io/) to leverage type information. To prevent errors or bugs caused by incorrect type data, it is recommended to [set the `tsconfig.json` `"strict"` option to `true`](https://www.typescriptlang.org/tsconfig/#strict).

Check out [`typescript-eslint`](https://typescript-eslint.io/getting-started/) for more information if you having an issue with configuring.

## License
[MIT License](https://github.com/Xvezda/eslint-plugin-explicit-exceptions/blob/master/LICENSE)
