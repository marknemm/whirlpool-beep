/**
 * Converts `lamports` to `SOL`.
 *
 * @param lamports The amount of `lamports` to convert.
 * @returns The amount of `SOL`.
 */
export function lamportsToSol(lamports: number): number {
  return lamports ? lamports / 1e9 : 0;
}

/**
 * Converts `SOL` to `lamports`.
 *
 * @param sol The amount of `SOL` to convert.
 * @returns The amount of `lamports`.
 */
export function solToLamports(sol: number): number {
  return sol ? sol * 1e9 : 0;
}
