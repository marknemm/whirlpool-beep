import { bool, cleanEnv, num, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables.
 */
const env = cleanEnv(process.env, {

  /**
   * The chain ID of the Solana cluster.
   *
   * `mainnet` = 101
   *
   * `devnet`= 103
   */
  CHAIN_ID: num(),

  /**
   * The margin to add to the compute unit estimate for a transaction. A percentage [0, 100].
   *
   * @default 10%
   */
  COMPUTE_LIMIT_MARGIN: num({ default: 10 }),

  /**
   * The database root certificate authority signature.
   */
  DB_CA: str({ default: undefined }),

  /**
   * The database host.
   */
  DB_HOST: str(),

  /**
   * The database name.
   */
  DB_NAME: str(),

  /**
   * The database password.
   */
  DB_PASSWORD: str(),

  /**
   * The database port.
   *
   * @default 5432
   */
  DB_PORT: num({ default: 5432 }),

  /**
   * The database user.
   */
  DB_USER: str(),

  /**
   * Whether to use SSL for the database connection.
   *
   * @default true
   */
  DB_SSL: bool({ default: true }),

  /**
   * The Helius API endpoint.
   */
  HELIUS_API: url(),

  /**
   * The Helius API key.
   *
   * @default ''
   */
  HELIUS_API_KEY: str({ default: '' }),

  /**
   * The log line break length.
   *
   * @default 40
   */
  LOG_BREAK_LEN: num({ default: 40 }),

  /**
   * Whether to colorize log output.
   *
   * @default false
   */
  LOG_COLOR: bool({ default: false }),

  /**
   * The max JSON depth to log.
   *
   * @default 3
   */
  LOG_DEPTH: num({ default: 3 }),

  /**
   * The log file output path.
   *
   * @default ''
   */
  LOG_FILE_OUT: str({ default: '' }),

  /**
   * The lowest log level to output.
   *
   * @default 'info'
   */
  LOG_LEVEL: str({
    choices: ['debug', 'info'],
    default: 'info'
  }),

  /**
   * Whether to log timestamps.
   *
   * @default false
   */
  LOG_TIMESTAMP: bool({ default: false }),

  /**
   * The node environment.
   */
  NODE_ENV: str({ choices: ['development', 'production', 'test'] }),

  /**
   * The default priority to use when generating the compute budget for a transaction.
   *
   * @default 'medium'
   */
  PRIORITY_LEVEL_DEFAULT: str({
    choices: ['min', 'low', 'medium', 'high', 'veryHigh', 'unsafeMax'],
    default: 'medium'
  }),

  /**
   * The minimum total priority fee for a transaction in lamports.
   *
   * @default 10000 lamports (0.00001 SOL)
   */
  PRIORITY_FEE_MIN_LAMPORTS: num({ default: 10000 }),   // 0.00001 SOL

  /**
   * The maximum total priority fee for a transaction in lamports.
   *
   * @default 2000000 lamports (0.002 SOL)
   */
  PRIORITY_FEE_MAX_LAMPORTS: num({ default: 2000000 }), // 0.002 SOL

  /**
   * The RPC endpoint used to access the Solana cluster.
   */
  RPC_ENDPOINT: url(),

  /**
   * The default slippage tolerance to use when swapping tokens. A percentage [0, 100].
   *
   * @default 1%
   */
  SLIPPAGE_DEFAULT: num({ default: 1 }),

  /**
   * The API endpoint for listing token metadata based on a query such as a token symbol or name.
   */
  TOKEN_LIST_API: url(),

  /**
   * The API endpoint for getting the price of a token in USD.
   */
  TOKEN_PRICE_API: url(),

  /**
   * The user's base58 wallet address.
   */
  WALLET_ADDRESS: str(),

  /**
   * The user's base58 wallet private key.
   */
  WALLET_PRIVATE_KEY: str(),

  /**
   * The Orca Whirlpool config address.
   */
  WHIRLPOOL_CONFIG_ADDRESS: str(),

  /**
   * The Orca Whirlpool config extension address.
   */
  WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: str(),

});

export default env;

/**
 * Gets the secret environment variables.
 *
 * @returns The secret environment variables.
 */
export function getSecretEnvVars(): (keyof typeof env)[] {
  return Object.keys(env).filter(
    (key) => /API_KEY|PASSWORD|PRIVATE|RPC_ENDPOINT|SECRET/i.test(key)
  ) as (keyof typeof env)[];
}
