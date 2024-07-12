import { bool, cleanEnv, num, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables.
 */
const env = cleanEnv(process.env, {
  CHAIN_ID: num(),
  LOG_BREAK_LEN: num({ default: 40 }),
  LOG_COLOR: bool({ default: false }),
  LOG_DEPTH: num({ default: 3 }),
  LOG_LEVEL: str({ choices: ['debug', 'info'], default: 'info' }),
  LOG_TIMESTAMP: bool({ default: false }),
  NODE_ENV: str({ choices: ['development', 'production', 'test'] }),
  RPC_ENDPOINT: url(),
  TOKEN_LIST_API: url(),
  WALLET_ADDRESS: str(),
  WALLET_PRIVATE_KEY: str(),
  WHIRLPOOL_CONFIG_ADDRESS: str(),
  WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: str(),
});

export default env;
