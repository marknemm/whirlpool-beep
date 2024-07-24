import type { Null } from '@/interfaces/nullable';
import { BN } from '@coral-xyz/anchor';
import { DecimalUtil } from '@orca-so/common-sdk';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import Decimal from 'decimal.js';

/**
 * Converts a given currency `value` to a {@link bigint}.
 *
 * @param value The value to convert.
 * @param shift The number of decimal places to `right shift` the decimal point by. Defaults to `0`.
 * For example, if {@link shift} is `2`, the {@link value} `100` would be converted to `10_000`.
 * Will only shift the decimal point if the value is a {@link Decimal.Value}.
 * @returns The converted {@link bigint}. If given a `falsey` value, `0` is returned.
 */
export function toBigInt(value: bigint | BN | Decimal.Value | Null, shift = 0): bigint {
  if (value instanceof BN) {
    value = BigInt(value.toString());
  }

  if (typeof value === 'bigint' || value == null) {
    return value ?? 0n;
  }

  value = toDecimal(value);
  value = DecimalUtil.toBN(value, shift);
  return BigInt(value.toString());
}

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
  return sol ? sol * LAMPORTS_PER_SOL : 0;
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
  return lamports ? lamports / LAMPORTS_PER_SOL : 0;
}

/**
 * Converts a given currency `value` to a `string`.
 *
 * @param value The value to convert.
 * @param decimals The decimal precision and the number of decimal places to `left shift` the decimal point by.
 * Defaults to `0`.
 * For example, if {@link shift} is `2`, the {@link value} `100` would be converted to `1.00`.
 * Will only shift the decimal point if the value is not a {@link Decimal.Value}.
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

/**
 * Converts a given token amount to `USD` based off of a given {@link tokenPrice}.
 *
 * @param tokenAmount The amount of the token to convert.
 * @param tokenPrice The price of the token in `USD`.
 * @param shift The number of decimal places to `left shift` the decimal point by. Defaults to `0`.
 * For example, if {@link shift} is `2`, the {@link value} `100` would be converted to `1.00`.
 * Will only shift the decimal point if the value is not a {@link Decimal.Value}.
 * @returns The converted `USD` amount.
 */
export function toUSD(
  tokenAmount: BN | Decimal | number,
  tokenPrice: Decimal.Value,
  shift = 0
): Decimal {
  return toDecimal(tokenAmount, shift).mul(tokenPrice);
}
