import type { Null } from '@npc/core';
import type { LiquidityTxSummary } from '@npc/meteora/interfaces/liquidity.interfaces';
import type { CollectFeesRewardsTxSummary } from '@npc/meteora/services/collect-fees-rewards/collect-fees-rewards';
import type { Position } from '@npc/meteora/util/position/position';
import type { SendTransactionResult, TxSummary } from '@npc/solana';

/**
 * Close all {@link Position}s summary.
 */
export interface CloseAllPositionsSummary {

  /**
   * The {@link Position}s that failed during closing.
   *
   * Each failed {@link Position} should be associated with an {@link Error} in the {@link errs} array.
   */
  failures: { position: Position, err: unknown }[];

  /**
   * The {@link ClosePositionTxSummary}s for each successfully closed {@link Position}.
   */
  successes: ClosePositionTxSummary[];

}

/**
 * Options for closing a {@link Position}.
 */
export interface ClosePositionOptions {

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
   * Whether to ignore the cache and fetch the {@link Position} data from the blockchain.
   *
   * @default false
   */
  ignoreCache?: boolean;

}

/**
 * Summary of a close {@link Position} transaction.
 */
export interface ClosePositionTxSummary extends TxSummary {

  /**
   * The {@link Position} that was closed.
   */
  position: Position;

  /**
   * The {@link CollectFeesRewardsTxSummary} for the collect fees and rewards transaction / instruction.
   *
   * `undefined` if the transaction was excluded via {@link ClosePositionOptions.excludeCollectFeesRewards}.
   */
  collectFeesRewardsTxSummary: CollectFeesRewardsTxSummary | Null;

  /**
   * The {@link LiquidityTxSummary} for the decrease liquidity transaction / instruction.
   *
   * `undefined` if the transaction was excluded via {@link ClosePositionOptions.excludeDecreaseLiquidity}.
   */
  decreaseLiquidityTxSummary: LiquidityTxSummary | Null;

}

/**
 * Arguments for generating a {@link ClosePositionTxSummary}.
 */
export interface ClosePositionTxSummaryArgs {

  /**
   * The {@link Position} that was closed.
   */
  position: Position;

  /**
   * The {@link SendTransactionResult} of the close {@link Position} transaction.
   */
  sendResult: SendTransactionResult;

}
