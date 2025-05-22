# `no-implicit-propagation`

This rule reports any function that calls a function documented with `@throws` (or `@exception`) but does not either:

1. Document which exception types it may propagate via its own JSDoc, or
1. Handle the exception with a `try…catch` block.

## Fixer

Wraps the code that throws into `try…catch` block.

## Options

### `tabLength`

Default: `4`

Controls the number of spaces used for indentation in the automatically inserted `try…catch` block.
