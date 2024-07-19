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
