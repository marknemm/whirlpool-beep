import env from '@/util/env';

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
 * {@link RegExp} to detect secret strings such as private keys.
 */
export const SECRETS_REGEX = new RegExp(
    `${PRIVATE_KEY_REGEX.source}`
  + `|${PRIVATE_KEY_BYTE_ARRAY_REGEX.source}`
  + `|${env.WALLET_PRIVATE_KEY}`
  , 'g'
);
