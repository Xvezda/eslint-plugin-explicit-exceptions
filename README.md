# eslint-plugin-explicit-exceptions

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
