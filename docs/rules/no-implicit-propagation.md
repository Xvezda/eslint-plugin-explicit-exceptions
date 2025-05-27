# `no-implicit-propagation`

This rule reports any function that calls a function documented with `@throws` (or `@exception`) but does not either:

1. Document which exception types it may propagate via its own JSDoc, or
1. Handle the exception with a `try…catch` block.

## Fixer

Inserts a `@throws` JSDoc tag (matching the delegated thrown type) immediately above the function declaration.

## Options

