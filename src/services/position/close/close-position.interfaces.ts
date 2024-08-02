import type { BundledPosition } from '@/interfaces/position.interfaces';
import { TransactionBuilder } from '@orca-so/common-sdk';

/**
 * Options for closing a {@link BundledPosition}.
 */
export interface ClosePositionOptions {

  /**
   * The {@link BundledPosition} to close.
   */
  bundledPosition: BundledPosition;

  /**
   * Whether to exclude collecting fees and rewards.
   *
   * @default false
   */
  excludeCollectFeesRewards?: boolean;

  /**
   * Whether to exclude decreasing liquidity.
   *
   * @default false
   */
  excludeDecreaseLiquidity?: boolean;

  /**
   * Whether to separate transactions for collecting fees and rewards, decreasing liquidity, and closing the position.
   * If `false`, all actions will be combined into a single transaction.
   *
   * @default false
   */
  separateTxs?: boolean;

}

/**
 * The result of generating a close position transaction.
 */
export interface GenClosePositionTxResult {

  /**
   * The transaction builder for the decrease liquidity transaction.
   */
  decreaseLiquidityTx?: TransactionBuilder;

  /**
   * The transaction builder for the collect fees and rewards transaction.
   */
  feesRewardsTx?: TransactionBuilder;

  /**
   * The transaction builder for the complete close position transaction.
   */
  tx: TransactionBuilder;

}
