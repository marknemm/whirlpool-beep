import { BN } from '@coral-xyz/anchor';
import { DecimalUtil } from '@orca-so/common-sdk';
import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';
import Decimal from 'decimal.js';

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
 * Converts a given currency `value` to a `number`.
 *
 * @param value The value to convert.
 * @param decimals The number of decimals to offset the {@link value} by. Defaults to `0`.
 * For example, if `decimals` is `2`, the {@link value} `100` would be converted to `1.00`.
 * @returns The converted `number`. If given a `falsey` value, `0` is returned.
 */
export function toNum(value: Decimal | bigint | BN | number | string, decimals = 0): number {
  return parseFloat(toStr(value, decimals));
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
 * Converts a given currency `value` to a `string`.
 *
 * @param value The value to convert.
 * @param decimals The number of decimals to offset the {@link value} by. Defaults to `0`.
 * For example, if `decimals` is `2`, the {@link value} `100` would be converted to `1.00`.
 * @returns The converted `string`. if given a `falsey` value, `'0'` is returned.
 */
export function toStr(value: Decimal | bigint | BN | number | string, decimals = 0): string {
  if (!value) return '0';

  value = !(value instanceof Decimal)
    ? DecimalUtil.fromBN(
      new BN(value?.toString() ?? '0'),
      decimals
    )
    : value;

  return value.toFixed(decimals);
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
