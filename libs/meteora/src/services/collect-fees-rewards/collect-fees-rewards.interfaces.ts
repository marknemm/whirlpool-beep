import type { Position } from '@npc/meteora/util/position/position';
import type { TxSummary } from '@npc/solana';
import type { TransactionSignature } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * Summary of a collect fees and rewards transaction for a {@link Position}.
 */
export interface CollectFeesRewardsTxSummary extends TxSummary {

  // TODO: Add rewards field(s).

  /**
   * The {@link Position} that the fees and rewards are associated with.
   */
  position: Position;

  /**
   * The signature of the transaction.
   */
  signature: TransactionSignature;

  /**
   * The amount of token X fees that were collected.
   */
  tokenAmountX: BN;

  /**
   * The amount of token Y fees that were collected.
   */
  tokenAmountY: BN;

}
