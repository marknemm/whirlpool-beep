import type { EmptyPositionData, EmptyPositionSummary } from '@npc/orca/services/empty-position/empty-position.interfaces';
import type { BundledPosition } from '@npc/orca/util/position/position';
import type { InstructionSet, TxSummary } from '@npc/solana';

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
  successes: ClosePositionSummary[];

}

/**
 * Arguments for closing a {@link BundledPosition}.
 */
export interface ClosePositionArgs {

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
 * Data for closing a {@link Position}.
 */
export type ClosePositionData = EmptyPositionData;

/**
 * The {@link InstructionSet} for closing a {@link Position}.
 */
export interface ClosePositionIxSet extends InstructionSet {

  /**
   * The {@link ClosePositionData} for the close position transaction.
   */
  data: ClosePositionData;

}

/**
 * The {@link TxSummary} for closing a {@link Position}.
 */
export interface ClosePositionSummary extends TxSummary, EmptyPositionSummary {

  /**
   * The {@link ClosePositionData} for the close position transaction.
   */
  data: ClosePositionData;

}
