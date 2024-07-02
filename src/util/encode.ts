import bs58 from 'bs58';

/**
 * Decodes a given `base58` string {@link input} into a raw {@link Uint8Array}.
 *
 * @param input A `base58` encoded string.
 * @returns The {@link input} as a raw {@link Uint8Array}. Returns an empty {@link Uint8Array} if the input is empty.
 */
export function decodeBase58(input: string | null): Uint8Array {
  return input
    ? Uint8Array.from(bs58.decode(input.trim()))
    : new Uint8Array();
}

/**
 * Encodes a given {@link Uint8Array} {@link input} into a `base58` string.
 *
 * @param input Either a JSON string that can be parsed into a {@link Uint8Array} or a raw {@link Uint8Array}.
 * @returns The {@link input} as a `base58` encoded string. Returns `''` if the input is empty.
 */
export function encodeBase58(input: string | Uint8Array | null): string {
  if (!input) return '';

  if (typeof input === 'string') {
    input = JSON.parse(input) as Uint8Array;
  }
  return bs58.encode(Uint8Array.from(input));
}
