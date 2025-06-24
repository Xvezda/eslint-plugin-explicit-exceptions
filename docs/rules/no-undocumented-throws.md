# `no-undocumented-throws`

This rule reports any function containing a throw statement that is not documented with a `@throws` (or `@exception`) tag in its JSDoc.

## Fixer

Inserts a `@throws` JSDoc tag (matching the thrown type) immediately above the function declaration.

## Options

### `useBaseTypeOfLiteral`

Default: `false`

When a literal value is thrown, document its base type rather than the literal type.
For example, for `throw "foo"`, insert `@throws {string}` instead of `@throws {"foo"}`.

```ts
// useBaseTypeOfLiteral: true
/**
 * @throws {string}
 */
function test() {
  throw 'foo';
}

// useBaseTypeOfLiteral: false
/**
 * @throws {'foo'}
 */
function test() {
  throw 'foo';
}
```

### `preferUnionType`

Default: `true`

When more than one exception can be thrown, the types are added as a union type in the comment.
If set to `false`, each exception is written on its own line.

```ts
// preferUnionType: true
/**
 * @throws {FooError | BarError}
 */
function test() {
  if (Math.random() < 0.5) {
    throw new FooError();
  } else {
    throw new BarError();
  }
}

// preferUnionType: false
/**
 * @throws {FooError}
 * @throws {BarError}
 */
function test() {
  if (Math.random() < 0.5) {
    throw new FooError();
  } else {
    throw new BarError();
  }
}
```
