import { type Address } from '@coral-xyz/anchor';
import { type Null } from '@npc/core';
import { PUBLIC_KEY_REGEX } from '@npc/solana/constants/regex';
import { PublicKey } from '@solana/web3.js';

/**
 * Checks if the given value is a valid {@link Address}.
 *
 * @param address The value to check.
 * @returns `true` if the value is a valid {@link Address}, `false` otherwise.
 */
export function isAddress(address: unknown): address is Address {
  return isPubKey(address as Address)
      || isPubKeyStr(address as Address);
}

/**
 * Checks if the given value is a valid {@link PublicKey}.
 *
 * @param address The value to check.
 * @returns `true` if the value is a valid {@link PublicKey}, `false` otherwise.
 */
export function isPubKey(address: Address | Null): address is PublicKey {
  return address instanceof PublicKey;
}

/**
 * Checks if the given value is a valid base-58 {@link Address} {@link string}.
 *
 * @param address The value to check.
 * @returns `true` if the value is a valid base-58 {@link Address} {@link string}, `false` otherwise.
 */
export function isPubKeyStr(address: Address | Null): address is string {
  return typeof address === 'string'
      && PUBLIC_KEY_REGEX.test(address);
}

/**
 * Converts the given {@link Address} to a {@link PublicKey}.
 *
 * @param address The {@link Address} to convert.
 * @returns The {@link PublicKey} representation of the {@link Address}.
 */
export function toPubKey(address: Address): PublicKey {
  return isPubKey(address)
    ? address
    : new PublicKey(address);
}

/**
 * Converts the given {@link Address} to a base-58 {@link string}.
 *
 * @param address The {@link Address} to convert.
 * @returns The base-58 {@link string} representation of the {@link Address}.
 */
export function toPubKeyStr(address: Address): string {
  return isPubKeyStr(address)
    ? address
    : toPubKey(address).toBase58();
}
