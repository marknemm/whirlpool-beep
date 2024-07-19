import type BN from 'bn.js';

/**
 * Summary of a generic transaction.
 */
export interface TransactionSummary {

  /**
   * The signature of the transaction.
   */
  signature: string;

  /**
   * The deltas for each token in the transaction.
   */
  tokens: Map<string, BN>;

  /**
   * The total delta of the transaction in USD.
   */
  usd: number;

}
