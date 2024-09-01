import tseslint from 'typescript-eslint';
import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  ...tseslint.config({}),
]
