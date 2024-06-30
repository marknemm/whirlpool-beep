import type Decimal from 'decimal.js';

/**
 * Converts `SOL` to `lamports`.
 *
 * @param sol The amount of `SOL` to convert.
 * @returns The amount of `lamports`.
 */
export function toLamports(sol: number): number {
  return sol ? sol * 1e9 : 0;
}

/**
 * Converts a currency {@link amount} {@link Decimal} value to a number with a specified number of {@link decimals}.
 *
 * @param amount The currency {@link Decimal} amount to convert.
 * @param decimals The number of decimals to round to.
 * @returns The currency {@link amount} as a number.
 */
export function toNum(amount: Decimal, decimals: number): number {
  return parseFloat(amount.toFixed(decimals));
}

/**
 * Converts `lamports` to `SOL`.
 *
 * @param lamports The amount of `lamports` to convert.
 * @returns The amount of `SOL`.
 */
export function toSol(lamports: number): number {
  return lamports ? lamports / 1e9 : 0;
}
