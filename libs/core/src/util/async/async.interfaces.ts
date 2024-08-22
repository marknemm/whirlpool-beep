import type { expBackoff } from '@npc/core/util/async/async.js'; // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * Options for the {@link expBackoff} function.
 */
export interface ExpBackoffOpts<T = unknown> {

  /**
   * Callback function to execute after each attempt regardless of success or failure.
   *
   * @param attempt The current attempt number.
   * @param result The result of the async function.
   * @param err The error thrown by the async function.
   */
  afterAttempt?: (attempt: number, result?: T, err?: unknown) => void;

  /**
   * The base delay in milliseconds.
   *
   * @default env.RETRY_BASE_DELAY
   */
  baseDelay?: number;

  /**
   * The maximum delay in milliseconds.
   * If the delay exceeds this value, it will not increase further.
   *
   * @default env.RETRY_MAX_DELAY
   */
  maxDelay?: number;

  /**
   * The maximum number of retries.
   * If the number of retries exceeds this value, the function will stop retrying.
   *
   * @default env.RETRY_MAX_RETRIES
   */
  maxRetries?: number;

  /**
   * The retry filter function.
   *
   * @param result The result of the async function.
   * @param err The error thrown by the async function.
   * @returns `true` to retry; `false` to stop retrying.
   * @default `(result, err) => !!err`
   */
  retryFilter?: (result?: T, err?: unknown) => boolean;

}
