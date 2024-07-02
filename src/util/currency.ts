import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';
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
 * Converts `lamports` to `SOL`.
 *
 * @param lamports The amount of `lamports` to convert.
 * @returns The amount of `SOL`.
 */
export function toSol(lamports: number): number {
  return lamports ? lamports / 1e9 : 0;
}

/**
 * Converts a given {@link Whirlpool} sqrtPrice to a price.
 *
 * @param whirlpool The {@link Whirlpool} to get the price of.
 * @returns The {@link Decimal} price of the {@link Whirlpool}.
 */
export function toPrice(whirlpool: Whirlpool): Decimal {
  const { sqrtPrice } = whirlpool.getData();
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  return PriceMath.sqrtPriceX64ToPrice(sqrtPrice, tokenA.decimals, tokenB.decimals);
}
