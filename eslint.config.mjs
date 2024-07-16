import eslint from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import noFloatingPromise from 'eslint-plugin-no-floating-promise';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['src/**/*.{js,mjs,cjs,ts}'],
  ignores: ['node_modules', 'dist'],
  extends: [
    eslint.configs.recommended,
    jsdoc.configs['flat/recommended'],
    ...tseslint.configs.recommended,
  ],
  plugins: {
    // @ts-ignore
    'no-floating-promise': noFloatingPromise,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', {             // Enable the warning about unused variables
      args: 'none',                                             // Do not check for unused function arguments
      caughtErrors: 'none',                                     // Do not check for unused caught errors
      varsIgnorePattern: '^[A-Z]|^_',                           // Ignore variables (type / class imports) that start with an uppercase letter or an underscore
    }],
    'camelcase': 'warn',                                        // Use camelCase for variable names
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
    'jsdoc/require-property-type': 'off',                       // Disable the warning about requiring JSDoc property types
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
    'max-len': ['warn', {                                       // Enable the warning about line length
      code: 120,                                                // Set the maximum line length to 120 characters
      ignoreComments: true,                                     // Ignore comments when checking line length
      ignorePattern: '^import\\s.+\\sfrom\\s.+;$',              // Ignore import statements when checking line length
      ignoreRegExpLiterals: true,                               // Ignore regular expressions when checking line length
      ignoreUrls: true,                                         // Ignore URLs when checking line length
    }],
    'multiline-ternary': ['warn', 'always-multiline'],          // Enable the warning about multiline ternary expressions
    'no-await-in-loop': 'off',                                  // Disable the rule that disallows using await inside of loops
    'no-console': 'error',                                      // Disallow the use of console.log - IMPORTANT to prevent leaking secrets!
    'no-else-return': 'warn',                                   // Enable the warning about using else return
    'no-empty': 'warn',                                         // Enable the warning about empty blocks
    'no-empty-function': 'warn',                                // Enable the warning about empty functions
    'no-extra-parens': ['warn', 'all', {                        // Enable the warning about extra parentheses
      conditionalAssign: false,                                 // Allow extra parentheses in conditional assignments
      enforceForArrowConditionals: false,                       // Allow extra parentheses in arrow function conditionals
      ignoreJSX: 'multi-line',                                  // Ignore JSX expressions that span multiple lines
      nestedBinaryExpressions: false,                           // Allow extra parentheses in nested binary expressions
      returnAssign: false,                                      // Allow extra parentheses in return assignments
      ternaryOperandBinaryExpressions: false,                   // Allow extra parentheses in ternary operand binary expressions
    }],
    'no-extra-semi': 'warn',                                    // Enable the warning about extra semicolons
    'no-floating-promise/no-floating-promise': 'warn',          // Enable the warning about floating promises
    'no-minusminus': 'off',                                     // Disable the rule that disallows unary operators
    'no-multi-spaces': 'off',                                   // Disable the rule that disallows multiple spaces
    'no-multiple-empty-lines': 'warn',                          // Enable the warning about multiple empty lines
    'no-nested-ternary': 'off',                                 // Disable the rule that disallows nested ternary expressions
    'no-param-reassign': 'off',                                 // Disable the rule that disallows reassigning function parameters
    'no-plusplus': 'off',                                       // Disable the rule that disallows unary operators
    'no-promise-executor-return': 'warn',                       // Enable the warning about returning values from promise executors
    'no-restricted-imports': ['error', 'console', 'winston'],   // Disallow importing certain modules - IMPORTANT to prevent vulnerabilities!
    'no-restricted-syntax': 'off',                              // Disable the rule that disallows specific syntax
    'no-trailing-spaces': 'warn',                               // Enable the warning about trailing spaces
    'no-underscore-dangle': 'off',                              // Disable the rule that disallows dangling underscores
    'no-unneeded-ternary': 'warn',                              // Enable the warning about unneeded ternary expressions
    'no-unreachable': 'warn',                                   // Enable the warning about unreachable code
    'no-unused-expressions': ['warn', {                         // Enable the warning about unused expressions
      allowTernary: true,                                       // Allow ternary expressions
    }],
    'no-unused-private-class-members': 'warn',                  // Enable the warning about unused private class members
    'no-unused-vars': 'off',                                    // Disable the rule that disallows unused variables (use TypeScript instead)
    'no-useless-constructor': 'off',                            // Enable the warning about useless constructors
    'no-useless-return': 'warn',                                // Enable the warning about useless return statements
    'no-use-before-define': 'off',                              // Disable the rule that disallows using variables before they are defined (use TypeScript instead)
    'object-curly-newline': ['warn', {                          // Enable the warning about object curly newlines
      consistent: true,                                         // Require consistent newlines in object literals
    }],
    'object-curly-spacing': ['warn', 'always'],                 // Enable the warning about object curly spacing
    'object-property-newline': ['warn', {                       // Enable the warning about object property newlines
      allowAllPropertiesOnSameLine: true,                       // Allow all properties to be on the same line
    }],
    'object-shorthand': 'warn',                                 // Enable the warning about object shorthand
    'one-var': ['warn', {                                       // Enable the warning about variable declarations
      initialized: 'never',                                     // Do not require variables to be initialized
      uninitialized: 'consecutive',                             // Require consecutive uninitialized variables
    }],
    'one-var-declaration-per-line': 'off',                      // Disable the rule that requires one variable declaration per line
    'operator-linebreak': ['warn', 'before'],                   // Enable the warning about operator line breaks
    'padded-blocks': ['warn', {                                 // Enable the warning about padding within blocks
      blocks: 'never',                                          // Do not require padding within blocks
      classes: 'always',                                        // Require padding within classes
      switches: 'never',                                        // Do not require padding within switch statements
    }],
    'prefer-arrow-callback': ['warn', {                         // Enable the warning about using arrow functions for callbacks
      allowNamedFunctions: true,                                // Allow named functions
    }],
    'prefer-const': 'warn',                                     // Enable the warning about using const
    'prefer-destructuring': 'warn',                             // Enable the warning about using destructuring
    'prefer-template': 'warn',                                  // Enable the warning about using template literals
    'quotes': ['warn', 'single'],                               // Use single quotes for strings
    'semi': ['warn', 'always'],                                 // Add semicolons at the end of each statement
    'space-before-blocks': 'warn',                              // Enable the warning about spacing before blocks
    'space-in-parens': 'warn',                                  // Enable the warning about spacing in parentheses
    'space-infix-ops': 'warn',                                  // Enable the warning about spacing in infix operators
    'spaced-comment': 'warn',                                   // Enable the warning about spacing in comments
  }
});
