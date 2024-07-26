import type { ExpBackoffOpts } from '@/interfaces/async';
import env from '@/util/env';
import { debug, warn } from '@/util/log';

/**
 * Executes a given async {@link fn} with exponential backoff.
 *
 * @param fn The async function to execute.
 * @param opts The {@link ExpBackoffOpts}.
 * @returns A {@link Promise} that resolves to the result of the async function.
 * @throws If the maximum number of retries is exceeded.
 */
export async function expBackoff<T>(
  fn: (retry: number) => Promise<T>,
  opts: ExpBackoffOpts<T> = {}
): Promise<T> {
  const baseDelay = opts.baseDelay ?? env.RETRY_BASE_DELAY;
  const maxDelay = opts.maxDelay ?? env.RETRY_MAX_DELAY;
  const maxRetries = opts.maxRetries ?? env.RETRY_MAX_RETRIES;
  const retryFilter = opts.retryFilter ?? ((result, err) => !!err);

  let retry = 0;

  do {
    try {
      const result = await fn(retry);
      if (retryFilter(result) && retry < maxRetries) continue;
      return result;
    } catch (err) {
      if (!retryFilter(undefined, err) || retry >= maxRetries) {
        throw err;
      }
      warn('Error triggering retry:', err);
    }

    const delay = Math.min(
      baseDelay * (2 ** retry),
      maxDelay
    );

    debug(`Retrying after ${delay} ms...`);
    await timeout(delay);
    debug(`Retrying ( retry: ${retry + 1} )...`);

    retry++;
  } while (true); // eslint-disable-line no-constant-condition
}

/**
 * Waits for a specified number of milliseconds.
 *
 * @param ms The number of milliseconds to wait.
 * @returns A {@link Promise} that resolves when the time has elapsed.
 */
export async function timeout(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
