import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['src/**/*.{js,mjs,cjs,ts}'],
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', {           // Enable the warning about unused variables
      args: 'none',                                           // Do not check for unused function arguments
      caughtErrors: 'none',                                   // Do not check for unused caught errors
      varsIgnorePattern: '^[A-Z]|^_',                         // Ignore variables (type / class imports) that start with an uppercase letter or an underscore
    }],
    'camelcase': 'warn',                                      // Use camelCase for variable names
    'max-len': ['warn', {                                     // Enable the warning about line length
      code: 120,                                              // Set the maximum line length to 120 characters
      ignoreComments: true,                                   // Ignore comments when checking line length
      ignorePattern: '^import\\s.+\\sfrom\\s.+;$',            // Ignore import statements when checking line length
      ignoreRegExpLiterals: true,                             // Ignore regular expressions when checking line length
      ignoreUrls: true,                                       // Ignore URLs when checking line length
    }],
    'no-console': 'error',                                    // Disallow the use of console.log - IMPORTANT to prevent leaking secrets!
    'no-restricted-imports': ['error', 'console', 'winston'], // Disallow importing certain modules - IMPORTANT to prevent vulnerabilities!
    'no-unused-vars': 'off',                                  // Disable the rule that checks for unused variables (use TS version instead)
    'quotes': ['warn', 'single'],                             // Use single quotes for strings
    'semi': ['warn', 'always'],                               // Add semicolons at the end of each statement
  }
});
