import { cleanEnv, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables.
 */
export const env = cleanEnv(process.env, {
  ANCHOR_PROVIDER_URL: url(),
  ANCHOR_WALLET: str({ default: 'wallet.json' }),
  NODE_ENV: str({ choices: ['development', 'production', 'test'] }),
  WALLET_ADDRESS: str(),
  WALLET_PRIVATE_KEY: str(),
  WHIRLPOOL_CONFIG_ADDRESS: str(),
  WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: str(),
});
