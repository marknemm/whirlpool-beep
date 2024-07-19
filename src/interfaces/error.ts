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
