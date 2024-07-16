import type { Null } from '@/interfaces/nullable';
import { BN } from '@coral-xyz/anchor';
import { DecimalUtil } from '@orca-so/common-sdk';
import { PriceMath } from '@orca-so/whirlpools-sdk';
import Decimal from 'decimal.js';

/**
 * Converts a given currency `value` to a {@link BN}.
 *
 * @param value The value to convert.
 * @param shift The number of decimal places to `right shift` the decimal point by. Defaults to `0`.
 * For example, if {@link shift} is `2`, the {@link value} `100` would be converted to `10_000`.
 * Will only shift the decimal point if the value is a {@link Decimal.Value}.
 * @returns The converted {@link BN}. If given a `falsey` value, `0` is returned.
 */
export function toBN(value: bigint | BN | Decimal.Value | Null, shift = 0): BN {
  if (typeof value === 'bigint') {
    value = new BN(value.toString());
  }

  if (value instanceof BN || value == null) {
    return value ?? new BN(0);
  }

  value = toDecimal(value);
  return DecimalUtil.toBN(value, shift);
}

/**
 * Converts a given currency `value` to a {@link Decimal}.
 *
 * @param value The value to convert.
 * @param shift The number of decimal places to `left shift` the decimal point by. Defaults to `0`.
 * For example, if {@link shift} is `2`, the {@link value} `100` would be converted to `1.00`.
 * Will only shift the decimal point if the value is not a {@link Decimal.Value}.
 * @returns The converted {@link Decimal}. If given a `falsey` value, `0` is returned.
 */
export function toDecimal(value: bigint | BN | Decimal.Value | Null, shift = 0): Decimal {
  if (typeof value === 'number' || typeof value === 'string') {
    value = new Decimal(value);
  }

  if (value instanceof Decimal || value == null) {
    return value ?? new Decimal(0);
  }

  if (typeof value === 'bigint') {
    value = new BN(value.toString());
  }
  return DecimalUtil.fromBN(value, shift);
}

/**
 * Converts `SOL` to `lamports`.
 *
 * @param sol The amount of `SOL` to convert.
 * @returns The amount of `lamports`.
 */
export function toLamports(sol: number | Null): number {
  return sol ? sol * 1e9 : 0;
}

/**
 * Converts a given currency `value` to a `number`.
 *
 * @param value The value to convert.
 * @param decimals The decimal precision. Defaults to `0`.
 * @returns The converted `number`. If given a `falsey` value, `0` is returned.
 */
export function toNum(value: bigint | BN | Decimal.Value | Null, decimals = 0): number {
  return parseFloat(toStr(value, decimals));
}

/**
 * Converts `lamports` to `SOL`.
 *
 * @param lamports The amount of `lamports` to convert.
 * @returns The amount of `SOL`.
 */
export function toSol(lamports: number | Null): number {
  return lamports ? lamports / 1e9 : 0;
}

/**
 * Converts a given currency `value` to a `string`.
 *
 * @param value The value to convert.
 * @param decimals The decimal precision. Defaults to `0`.
 * @returns The converted `string`. if given a `falsey` value, `'0'` is returned.
 */
export function toStr(value: bigint | BN | Decimal.Value | Null, decimals = 0): string {
  if (!value) return '0';

  if (decimals) {
    value = (typeof value === 'bigint' || value instanceof BN)
      ? toDecimal(value, decimals) // Only left shift decimal point for BN
      : toDecimal(value);

    return value.toFixed(decimals);
  }

  return value.toString();
}

/**
 * Converts a given tick range to a price range.
 *
 * @param tickRange The tick range to convert.
 * @param decimalPair The decimal pair to use for the conversion.
 * The first element is the decimal for `token A`, and the second element is the decimal for `token B`.
 * @returns The converted price range.
 */
export function toPriceRange(
  tickRange: [number, number],
  decimalPair: [number, number]
): [Decimal, Decimal] {
  const [decimalsA, decimalsB] = decimalPair;

  return [
    PriceMath.tickIndexToPrice(tickRange[0], decimalsA, decimalsB),
    PriceMath.tickIndexToPrice(tickRange[1], decimalsA, decimalsB),
  ];
}

/**
 * Converts a given price range to a tick range.
 *
 * If {@link tickSpacing} is provided, the conversion will account for spacing and may not be an exact mapping.
 *
 * @param priceRange The price range to convert.
 * @param decimalPair The decimal pair to use for the conversion.
 * The first element is the decimal for `token A`, and the second element is the decimal for `token B`.
 * @param tickSpacing The tick spacing to use for the conversion. Defaults to `1`.
 * @returns The converted tick range.
 */
export function toTickRange(
  priceRange: [Decimal, Decimal],
  decimalPair: [number, number],
  tickSpacing?: number
): [number, number] {
  const [decimalsA, decimalsB] = decimalPair;

  return tickSpacing
    ? [
      PriceMath.priceToInitializableTickIndex(priceRange[0], decimalsA, decimalsB, tickSpacing),
      PriceMath.priceToInitializableTickIndex(priceRange[1], decimalsA, decimalsB, tickSpacing),
    ]
    : [
      PriceMath.priceToTickIndex(priceRange[0], decimalsA, decimalsB),
      PriceMath.priceToTickIndex(priceRange[1], decimalsA, decimalsB),
    ];
}

/**
 * Converts a given {@link usd} amount to a token amount based off of a given {@link tokenPrice}.
 *
 * @param usd The amount of `USD` to convert.
 * @param tokenPrice The price of the token in `USD`.
 * @returns The converted token amount.
 */
export function toTokenAmount(
  usd: BN | Decimal | number,
  tokenPrice: Decimal.Value
): Decimal {
  return toDecimal(usd).div(tokenPrice);
}
