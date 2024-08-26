import { REGEX_ESCAPE } from '@npc/core/constants/regex';
import { bool, cleanEnv, num, str } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables for core.
 */
export const env = cleanEnv(process.env, {

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

});

/**
 * Gets the names of secret environment variables.
 *
 * @returns The secret environment variable names.
 */
export function getSecretEnvVarNames<T extends Object>(): (keyof T)[] {
  return Object.keys(process.env).filter(
    (key) => /API_KEY|PASSWORD|PRIVATE|SECRET/i.test(key)
  ) as (keyof T)[];
}

/**
 * {@link RegExp} to detect secret environment variable values.
 */
export const SECRETS_REGEX = new RegExp(
  getSecretEnvVarNames()
    .map((key) => process.env[key]?.toString().replace(REGEX_ESCAPE, '\\$&'))
    .join('|').replace(/\|{2,}/g, '|').replace(/^\||\|$/g, ''),
  'g'
);

export default env;
