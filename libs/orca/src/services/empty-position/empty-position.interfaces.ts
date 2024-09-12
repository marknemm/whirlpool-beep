import type { Address } from '@coral-xyz/anchor';
import type { CollectFeesRewardsData } from '@npc/orca/services/collect-fees-rewards/collect-fees-rewards';
import type { DecreaseLiquidityData } from '@npc/orca/services/decrease-liquidity/decrease-liquidity';
import type { InstructionSet, TxSummary } from '@npc/solana';
import type { Position } from '@orca-so/whirlpools-sdk';

/**
 * Empty all {@link Position}s summary.
 */
export interface EmptyAllPositionsSummary {

  /**
   * The failures containing the {@link Position}s that failed during emptying.
   */
  failures: { position: Position, err: unknown }[];

  /**
   * The {@link Position}s that were skipped during emptying due to no liquidity, fees, or rewards to empty.
   */
  skips: { position: Position }[];

  /**
   * The {@link EmptyPositionSummary}s for each successfully emptied {@link Position}.
   */
  successes: EmptyPositionSummary[];

}

/**
 * Data for emptying a {@link Position} of its liquidity, fees, and rewards.
 */
export interface EmptyPositionData {

  /**
   * The {@link Address} of the {@link Position} to empty.
   */
  positionAddress: Address;

  /**
   * The {@link CollectFeesRewardsData} for the collect fees and rewards instruction.
   */
  collectFeesRewards: CollectFeesRewardsData | undefined;

  /**
   * The {@link DecreaseLiquidityData} for the decrease liquidity (to 0) instruction.
   */
  decreaseLiquidity: DecreaseLiquidityData | undefined;

}

/**
 * The {@link InstructionSet} for increasing liquidity in a {@link Position}.
 */
export interface EmptyPositionIxSet extends InstructionSet {

  /**
   * The {@link EmptyPositionData} for the increase liquidity transaction.
   */
  data: EmptyPositionData;

}

/**
 * The {@link TxSummary} for increasing liquidity in a {@link Position}.
 */
export interface EmptyPositionSummary extends TxSummary {

  /**
   * The {@link EmptyPositionData} for the increase liquidity transaction.
   */
  data: EmptyPositionData;

}
