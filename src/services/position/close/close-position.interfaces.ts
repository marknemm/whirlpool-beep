import type { BundledPosition } from '@/interfaces/position.interfaces';
import type { FeesRewardsTxSummary } from '@/services/fees-rewards/collect/collect-fees-rewards.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import type { TransactionBuilder } from '@orca-so/common-sdk';

/**
 * Close all positions result.
 */
export interface CloseAllPositionsResult {

  /**
   * The {@link BundledPosition}s that failed during closing.
   *
   * Each failed {@link BundledPosition} should be associated with an {@link Error} in the {@link errs} array.
   */
  failures: { bundledPosition: BundledPosition, err: unknown }[];

  /**
   * The {@link ClosePositionTxSummary}s for each successfully closed {@link BundledPosition}.
   */
  successes: ClosePositionTxSummary[];

}

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
 * Summary of a close position transaction.
 */
export interface ClosePositionTxSummary {

  /**
   * The {@link BundledPosition} that was closed.
   */
  bundledPosition: BundledPosition;

  /**
   * The {@link FeesRewardsTxSummary} for the collect fees and rewards transaction / instruction.
   *
   * `undefined` if the transaction was excluded via {@link ClosePositionOptions.excludeCollectFeesRewards}.
   */
  feesRewardsTxSummary?: FeesRewardsTxSummary;

  /**
   * The {@link LiquidityTxSummary} for the decrease liquidity transaction / instruction.
   *
   * `undefined` if the transaction was excluded via {@link ClosePositionOptions.excludeDecreaseLiquidity}.
   */
  liquidityTxSummary?: LiquidityTxSummary;

  /**
   * The fee (base + priority) for the close position transaction.
   */
  fee: number;

  /**
   * The signature of the close position transaction.
   */
  signature: string;

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

/**
 * Arguments for generating a {@link ClosePositionTxSummary}.
 */
export interface GenClosePositionTxSummaryArgs {

  /**
   * The {@link BundledPosition} to close.
   */
  bundledPosition: BundledPosition;

  /**
   * Whether to exclude the collect fees and rewards transaction from the summary.
   *
   * @default false
   */
  excludeCollectFeesRewards?: boolean;

  /**
   * Whether to exclude the decrease liquidity transaction from the summary.
   *
   * @default false
   */
  excludeDecreaseLiquidity?: boolean;

  /**
   * Whether transactions for collecting fees and rewards, decreasing liquidity, and closing the position were separated.
   *
   * If `false`, a single transaction was used for all actions.
   *
   * @default false
   */
  separateTxs?: boolean;

  /**
   * The signature of the close position transaction.
   */
  signature: string;

}
