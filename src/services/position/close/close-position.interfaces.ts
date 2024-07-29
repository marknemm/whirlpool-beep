import type { BundledPosition } from '@/interfaces/position.interfaces';

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