import env from '@/util/env';

/**
 * {@link RegExp} to detect decimal numbers.
 *
 * Also, provides 3 capture groups for:
 * 1. Leading whitespace
 * 2. The decimal number
 * 3. Trailing whitespace
 */
export const DECIMAL_REGEX = /(^|\s+)(\d+\.?\d*)(\s+|$)/g;

/**
 * {@link RegExp} to detect private keys in `base58` format.
 */
export const PRIVATE_KEY_REGEX = /[1-9A-HJ-NP-Za-km-z]{80,}/g;

/**
 * {@link RegExp} to detect private keys in raw `byte array` format.
 *
 * Also, provides 3 capture groups for:
 * 1. The optional opening square bracket
 * 2. The byte array content
 * 3. The optional closing square bracket
 */
export const PRIVATE_KEY_BYTE_ARRAY_REGEX = /(\[)?(([0-9]{1,3},){60,}[0-9]{1,3})(\])?/g;

/**
 * {@link RegExp} to detect secret strings such as private keys.
 */
export const SECRETS_REGEX = new RegExp(
    `${PRIVATE_KEY_REGEX.source}`
  + `|${PRIVATE_KEY_BYTE_ARRAY_REGEX.source}`
  + `|${env.WALLET_PRIVATE_KEY}`
  , 'g'
);
