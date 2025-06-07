# `check-throws-tag-type`

This rule reports any function where the types thrown—whether directly via throw statements or indirectly by calling throwable functions—do not match the types documented in its JSDoc @throws tags.

## Fixer

Inserts matching the thrown type in `@throws` JSDoc tag format right above the function declaration.

## Options

### `useBaseTypeOfLiteral`

Default: `false`

When a literal value is thrown, document its base type rather than the literal type.
For example, for `throw "foo"`, insert `@throws {string}` instead of `@throws {"foo"}`.

### `preferUnionType`

Default: `true`

When more than one exception can be thrown, the types are added as a union type in the comment.
If set to `false`, each exception is written on its own line.
