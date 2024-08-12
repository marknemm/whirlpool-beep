import type { Null } from '@/interfaces/nullable.interfaces';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import type { CollectFeesRewardsIxData, CollectFeesRewardsTxSummary } from '@/services/fees-rewards/collect/collect-fees-rewards.interfaces';
import type { DecreaseLiquidityIxData } from '@/services/liquidity/decrease/decrease-liquidity.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import type { InstructionData } from '@/util/transaction-context/transaction-context';
import type { TransactionSignature } from '@solana/web3.js';

/**
 * Close all {@link Position}s summary.
 */
export interface CloseAllPositionsSummary {

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

}

/**
 * Transaction instruction data for closing a {@link Position}.
 */
export interface ClosePositionIxData extends InstructionData {

  /**
   * The {@link CollectFeesRewardsIxData} for the collect fees and rewards instruction.
   */
  collectFeesRewardsIxData?: CollectFeesRewardsIxData;

  /**
   * The {@link DecreaseLiquidityIxData} for the decrease liquidity instruction.
   */
  decreaseLiquidityIxData?: DecreaseLiquidityIxData;

}

/**
 * Summary of a close {@link Position} transaction.
 */
export interface ClosePositionTxSummary {

  /**
   * The {@link BundledPosition} that was closed.
   */
  bundledPosition: BundledPosition;

  /**
   * The fee (base + priority) for the close {@link Position} transaction.
   */
  fee: number;

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

  /**
   * The signature of the close {@link Position} transaction.
   */
  signature: TransactionSignature;

}

/**
 * Arguments for generating a {@link ClosePositionTxSummary}.
 */
export interface ClosePositionTxSummaryArgs {

  /**
   * The {@link BundledPosition} that was closed.
   */
  bundledPosition: BundledPosition;

  /**
   * The {@link ClosePositionIxData} used to generate the summary.
   */
  closePositionIxData: ClosePositionIxData;

  /**
   * The signature of the close {@link Position} transaction.
   */
  signature: TransactionSignature;

}
