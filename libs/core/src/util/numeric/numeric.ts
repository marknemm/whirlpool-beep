import type { Null } from '@npc/core/interfaces/nullable.interfaces';
import BN from 'bn.js';
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
  value = value.mul(new Decimal(10).pow(shift)).trunc();
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
  value = value.mul(new Decimal(10).pow(shift)).trunc();
  return new BN(value.toString());
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
  return new Decimal(value.toString()).div(new Decimal(10).pow(shift));
}

/**
 * Converts a given currency `value` to a `number`.
 *
 * @param value The value to convert.
 * @param decimals The decimal precision. Defaults to `0`.
 * @returns The converted `number`. If given a `falsey` value, `0` is returned.
 */
export function toNumber(value: bigint | BN | Decimal.Value | Null, decimals = 0): number {
  return parseFloat(numericToString(value, decimals));
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
export function numericToString(value: bigint | BN | Decimal.Value | Null, decimals = 0): string {
  if (!value) return '0';

  if (decimals) {
    value = (typeof value === 'bigint' || value instanceof BN)
      ? toDecimal(value, decimals) // Only left shift decimal point for BN
      : toDecimal(value);

    return value.toFixed(decimals);
  }

  return value.toString();
}
