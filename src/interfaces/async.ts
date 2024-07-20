import type { Null } from '@/interfaces/nullable';
import type { expBackoff } from '@/util/async'; // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * Options for the {@link expBackoff} function.
 */
export interface ExpBackoffOpts<T = unknown> {

  /**
   * The base delay in milliseconds.
   *
   * @default 250
   */
  baseDelay?: number;

  /**
   * The maximum delay in milliseconds.
   * If the delay exceeds this value, it will not increase further.
   *
   * @default 4000
   */
  maxDelay?: number;

  /**
   * The maximum number of retries.
   * If the number of retries exceeds this value, the function will stop retrying.
   *
   * @default 5
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
  retryFilter?: (result: T | Null, err?: unknown) => boolean;

}