/**
 * The action performed on a transaction.
 */
export type TransactionAction = 'confirm' | 'send' | 'simulate';

/**
 * A transaction error that may occur when simulating or sending a {@link Transaction} or {@link VersionedTransaction}.
 */
export interface TransactionError {

  /**
   * The instruction error.
   */
  InstructionError: [
    number,
    {
      Custom: number;
    }
  ]
}
