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
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always'],
  }
});

