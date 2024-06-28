import { cleanEnv, num, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables.
 */
export const env = cleanEnv(process.env, {
  ANCHOR_PROVIDER_URL: url(),
  ANCHOR_WALLET: str({ default: 'wallet.json' }),
  CHAIN_ID: num(),
  LOG_LEVEL: str({ choices: ['debug', 'info'], default: 'info' }),
  NODE_ENV: str({ choices: ['development', 'production', 'test'] }),
  TICK_SPACING: num(),
  TOKEN_A: str(),
  TOKEN_B: str(),
  TOKEN_LIST_API: url(),
  WALLET_ADDRESS: str(),
  WALLET_PRIVATE_KEY: str(),
  WHIRLPOOL_CONFIG_ADDRESS: str(),
  WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: str(),
});
