# eslint-plugin-explicit-exceptions

![demo](https://github.com/user-attachments/assets/a9b0013f-9084-4914-9115-a7c6bd62cf3a)

Just as [Java’s throws keyword](https://dev.java/learn/exceptions/throwing/) does, enforcing the use of [JSDoc’s `@throws` tag](https://jsdoc.app/tags-throws) to explicitly specify which exceptions a function can throw to solve unpredictable propagation of exceptions happening which also known as a [JavaScript's "hidden exceptions"](https://www.youtube.com/watch?v=3iWoNJbGO2U).

## Usage

```sh
# https://typescript-eslint.io/getting-started/#step-1-installation
npm install --save-dev eslint @eslint/js typescript typescript-eslint

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

## Rules
 - [`no-implicit-propagation`](docs/rules/no-implicit-propagation.md)
 - [`no-undocumented-throws`](docs/rules/no-undocumented-throws.md)

## TODO
- [x] Report undocumented throws
- [x] Report unhandled throwable function calls
- [ ] Non type checked preset
