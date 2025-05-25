# eslint-plugin-explicit-exceptions



https://github.com/user-attachments/assets/bfc5db59-053d-40ab-be91-4533939ccc31



Just as [Java’s throws keyword](https://dev.java/learn/exceptions/throwing/) does, enforcing the use of [JSDoc’s `@throws` tag](https://jsdoc.app/tags-throws) to explicitly specify which exceptions a function can throw to solve unpredictable propagation of exceptions happening which also known as a [JavaScript's "hidden exceptions"](https://www.youtube.com/watch?v=3iWoNJbGO2U).

See [examples](./examples) for more.

## Features
- Reports and provides fixes for throwable functions that are not annotated with `@throws`.
- Reports and provides fixes for async functions and Promise rejections.
- Verifies that the exception types match the documented types.

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

## License
[MIT License](./LICENSE)
