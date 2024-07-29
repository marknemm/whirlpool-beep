import env, { getSecretEnvVars } from '@/util/env/env';

/**
 * {@link RegExp} to detect standalone decimal numbers.
 *
 * Also, provides 1 capture group for the decimal number.
 */
export const DECIMAL_REGEX = /(?<=^|\s)((?:[+-]?\$?|\$[+-]?)(?:(?:\d{1,3}(?:[,_]\d{3})*|\d+)\.?\d*|\.\d+))(?=\s|$)/g;

/**
 * {@link RegExp} to detect private keys in `base58` format.
 */
export const PRIVATE_KEY_REGEX = /[1-9A-HJ-NP-Za-km-z]{80,}/g;

/**
 * {@link RegExp} to detect private keys in raw `byte array` format.
 *
 * Also, provides a capture group for the byte array values.
 */
export const PRIVATE_KEY_BYTE_ARRAY_REGEX = /(?:\[\s*)?((?:[0-9]{1,3}\s*,\s*){60,}[0-9]{1,3})(?:\s*\])?/g;

/**
 * {@link RegExp} to detect public keys in `base58` format.
 */
export const PUBLIC_KEY_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

/**
 * {@link RegExp} to detect `regex` escape characters.
 */
export const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * {@link RegExp} to detect secret strings such as private keys, api keys, and passwords.
 */
export const SECRETS_REGEX = new RegExp(
  getSecretEnvVars()
    .map((key) => env[key]?.toString().replace(REGEX_ESCAPE, '\\$&'))
    .join('|'),
  'g'
);

/**
 * {@link RegExp} to detect stablecoin symbols via exact case-insensitive match.
 */
export const STABLECOIN_SYMBOL_REGEX = /^USDC|USDT|PAX|HUSD|DAI|UST|devUSDC|devUSDT$/i;
