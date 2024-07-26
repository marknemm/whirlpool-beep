/**
 * Represents an error with a code.
 *
 * @augments Error
 */
export interface ErrorWithCode extends Error {

  /**
   * The error code.
   */
  code: string;

}

/**
 * Error information pertaining to `IDL` errors thrown by `Anchor` or a `Smart Contract`.
 */
export interface TxProgramErrorInfo {

  /**
   * The error code.
   *
   * `< 6000` -> `Anchor`.
   *
   * `>= 6000` -> `Smart Contracts (Orca Whirlpool)`.
   */
  code: number;

  /**
   * The error message.
   */
  msg?: string;

  /**
   * The error name.
   */
  name: string;

}
