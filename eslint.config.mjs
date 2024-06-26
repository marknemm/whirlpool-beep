// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['src/**/*.{js,mjs,cjs,ts}'],
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', {     // Enable the warning about unused variables
      args: 'none',                                     // Do not check for unused function arguments
      caughtErrors: 'none',                             // Do not check for unused caught errors
      varsIgnorePattern: '^[A-Z]|^_',                   // Ignore variables (type / class imports) that start with an uppercase letter or an underscore
    }],
    'no-unused-vars': 'off',                            // Disable the rule that checks for unused variables (use TS version instead)
    'quotes': ['warn', 'single'],                       // Use single quotes for strings
    'semi': ['warn', 'always'],                         // Add semicolons at the end of each statement
  }
});

