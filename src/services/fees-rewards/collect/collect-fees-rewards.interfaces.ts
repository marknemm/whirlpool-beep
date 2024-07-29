import type { Position } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';

/**
 * Summary of a fees and rewards transaction for a {@link Position}.
 */
export interface FeesRewardsTxSummary {

  // TODO: Add rewards field(s).

  /**
   * The fee paid for the transaction in lamports.
   */
  fee: number;

  /**
   * The {@link Position} that the fees and rewards are associated with.
   */
  position: Position;

  /**
   * The signature of the transaction.
   */
  signature: string;

  /**
   * The amount of token A fees that were collected.
   */
  tokenAmountA: BN;

  /**
   * The amount of token B fees that were collected.
   */
  tokenAmountB: BN;

  /**
   * The total USD value of the fees and rewards collection.
   */
  usd: number;

}
