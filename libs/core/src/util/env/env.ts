import { bool, cleanEnv, num, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables.
 */
export const env = cleanEnv(process.env, {

  /**
   * The database root certificate authority signature.
   */
  DB_CA: str({ default: undefined }),

  /**
   * The database host.
   */
  DB_HOST: str(),

  /**
   * Whether to automatically migrate the database schema on startup.
   *
   * @default false
   */
  DB_MIGRATE: bool({ default: false }),

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
   * The default base delay used for exponential backoff.
   *
   * @default 250
   */
  RETRY_BASE_DELAY: num({ default: 250 }),

  /**
   * The default maximum delay used for exponential backoff.
   *
   * @default 5000
   */
  RETRY_MAX_DELAY: num({ default: 5000 }),

  /**
   * The default maximum number of retries used for exponential backoff.
   *
   * @default 10
   */
  RETRY_MAX_RETRIES: num({ default: 10 }),

  /**
   * The RPC endpoint used to access the Solana cluster.
   */
  RPC_ENDPOINT: url(),

  /**
   * The user's base58 wallet address.
   */
  WALLET_ADDRESS: str(),

  /**
   * The user's base58 wallet private key.
   */
  WALLET_PRIVATE_KEY: str(),

});

/**
 * Gets the secret environment variables.
 *
 * @returns The secret environment variables.
 */
export function getSecretEnvVars(): (keyof typeof env)[] {
  return Object.keys(env).filter(
    (key) => /API_KEY|PASSWORD|PRIVATE|^RPC_ENDPOINT|SECRET/i.test(key)
  ) as (keyof typeof env)[];
}

export default env;
