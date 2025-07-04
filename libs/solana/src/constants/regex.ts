/**
 * {@link RegExp} to detect private keys in `base58` format.
 */
export const PRIVATE_KEY_REGEX = /[A-HJ-NP-Za-km-z1-9]{80,}/;

/**
 * {@link RegExp} to detect private keys in raw `byte array` format.
 *
 * Also, provides a capture group for the byte array values.
 */
export const PRIVATE_KEY_BYTE_ARRAY_REGEX = /(?:\[\s*)?((?:[0-9]{1,3}\s*,\s*){60,}[0-9]{1,3})(?:\s*\])?/;

/**
 * {@link RegExp} to detect public keys in `base58` format.
 */
export const PUBLIC_KEY_REGEX = /[A-HJ-NP-Za-km-z1-9]{32,44}/;

/**
 * {@link RegExp} to detect stablecoin symbols via exact case-insensitive match.
 */
export const STABLECOIN_SYMBOL_REGEX = /^USDC|USDT|PAX|HUSD|DAI|UST|devUSDC|devUSDT$/i;
