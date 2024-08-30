/**
 * {@link RegExp} to detect standalone decimal numbers.
 *
 * Also, provides 1 capture group for the decimal number.
 */
export const DECIMAL_REGEX = /(?<=^|\s)((?:[+-]?\$?|\$[+-]?)(?:(?:\d{1,3}(?:[,_]\d{3})*|\d+)\.?\d*|\.\d+))(?=\s|$)/;

/**
 * {@link RegExp} to detect `regex` escape characters.
 */
export const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/;
