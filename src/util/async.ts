import { ExpBackoffOpts } from '@/interfaces/async';

/**
 * Executes a given async {@link fn} with exponential backoff.
 *
 * @param fn The async function to execute.
 * @param opts The {@link ExpBackoffOpts}.
 * @returns A {@link Promise} that resolves to the result of the async function.
 * @throws If the maximum number of retries is exceeded.
 */
export async function expBackoff<T>(
  fn: () => Promise<T>,
  opts?: ExpBackoffOpts<T>
): Promise<T> {
  opts ??= {};
  opts.baseDelay ??= 250;
  opts.maxDelay ??= 4000;
  opts.maxRetries ??= 5;
  opts.retryFilter ??= (result, err) => !!err;

  let retries = 0;
  let delay = opts.baseDelay;

  do {
    try {
      const result = await fn();
      if (opts.retryFilter(result)) continue;
      return result;
    } catch (err) {
      if (!opts.retryFilter(undefined, err) || retries++ >= opts.maxRetries) {
        throw err;
      }

      await timeout(delay);
      delay = Math.min(delay * 2, opts.maxDelay);
    }
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
