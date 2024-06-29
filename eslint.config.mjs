import eslint from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';
import noFloatingPromise from 'eslint-plugin-no-floating-promise';

export default tseslint.config({
  files: ['src/**/*.{js,mjs,cjs,ts}'],
  extends: [
    eslint.configs.recommended,
    jsdoc.configs['flat/recommended'],
    ...tseslint.configs.recommended,
  ],
  plugins: {
    'no-floating-promise': noFloatingPromise,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', {           // Enable the warning about unused variables
      args: 'none',                                           // Do not check for unused function arguments
      caughtErrors: 'none',                                   // Do not check for unused caught errors
      varsIgnorePattern: '^[A-Z]|^_',                         // Ignore variables (type / class imports) that start with an uppercase letter or an underscore
    }],
    'camelcase': 'warn',                                      // Use camelCase for variable names
    'jsdoc/check-indentation': 'warn',                          // Enable the warning about JSDoc indentation
    'jsdoc/check-syntax': 'warn',                               // Enable the warning about JSDoc syntax
    'jsdoc/check-param-names': ['warn', {                       // Enable the warning about JSDoc param names
      checkDestructured: false,                                 // Do not check destructured parameters
    }],
    'jsdoc/no-blank-blocks': 'warn',                            // Enable the warning about blank JSDoc blocks
    'jsdoc/no-undefined-types': 'off',                          // Enable the warning about undefined JSDoc types
    'jsdoc/require-asterisk-prefix': 'warn',                    // Enable the warning about JSDoc asterisk prefixes
    'jsdoc/require-description': 'warn',                        // Enable the warning about JSDoc descriptions
    'jsdoc/require-hyphen-before-param-description': 'off',     // Disable the rule that requires a hyphen before JSDoc param descriptions
    'jsdoc/require-jsdoc': ['warn', {                           // Enable the warning about requiring JSDoc comments
      contexts: [
        'VariableDeclaration',                                  // Encourage documenting variables
        'TSTypeAliasDeclaration',                               // Encourage documenting TypeScript type aliases
        'TSPropertySignature',                                  // Encourage documenting React prop types
      ],
      enableFixer: true,
      publicOnly: true,
      require: {
        ArrowFunctionExpression: true,
        ClassDeclaration: true,
        ClassExpression: true,
        FunctionDeclaration: true,
        FunctionExpression: true,
        MethodDefinition: true,
      },
    }],
    'jsdoc/require-param': ['warn', {                           // Enable the warning about requiring JSDoc param tags
      checkDestructuredRoots: false,                            // Do not check destructured roots
    }],
    'jsdoc/require-param-description': 'warn',                  // Enable the warning about requiring JSDoc param descriptions,
    'jsdoc/require-param-name': 'warn',                         // Enable the warning about requiring JSDoc param names
    'jsdoc/require-param-type': 'off',                          // Disable the warning about requiring JSDoc param types
    'jsdoc/require-returns': ['warn', {                         // Enable the warning about requiring JSDoc return tags
      checkGetters: false,                                      // Do not check getters
    }],
    'jsdoc/require-returns-check': 'warn',                      // Enable the warning about requiring JSDoc return checks
    'jsdoc/require-returns-description': 'warn',                // Enable the warning about requiring JSDoc return descriptions
    'jsdoc/require-returns-type': 'off',                        // Disable the warning about requiring JSDoc return types
    'jsdoc/require-throws': 'warn',                             // Enable the warning about requiring JSDoc throw tags
    'jsdoc/sort-tags': 'warn',                                  // Enable the warning about sorting JSDoc tags
    'jsdoc/tag-lines': ['warn', 'never', {                      // Enable the warning about JSDoc tag lines
      startLines: 1,                                            // Require tags to be on the same line as the comment
    }],
    'max-len': ['warn', {                                     // Enable the warning about line length
      code: 120,                                              // Set the maximum line length to 120 characters
      ignoreComments: true,                                   // Ignore comments when checking line length
      ignorePattern: '^import\\s.+\\sfrom\\s.+;$',            // Ignore import statements when checking line length
      ignoreRegExpLiterals: true,                             // Ignore regular expressions when checking line length
      ignoreUrls: true,                                       // Ignore URLs when checking line length
    }],
    'no-console': 'error',                                    // Disallow the use of console.log - IMPORTANT to prevent leaking secrets!
    'no-floating-promise/no-floating-promise': 'warn',        // Enable the warning about floating promises
    'no-restricted-imports': ['error', 'console', 'winston'], // Disallow importing certain modules - IMPORTANT to prevent vulnerabilities!
    'no-unused-vars': 'off',                                  // Disable the rule that checks for unused variables (use TS version instead)
    'quotes': ['warn', 'single'],                             // Use single quotes for strings
    'semi': ['warn', 'always'],                               // Add semicolons at the end of each statement
  }
});
