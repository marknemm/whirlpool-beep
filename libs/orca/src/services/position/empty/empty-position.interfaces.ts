import type { CollectFeesRewardsIxData, CollectFeesRewardsTxSummary } from '@npc/orca/services/fees-rewards/collect/collect-fees-rewards.js';
import type { DecreaseLiquidityIxData } from '@npc/orca/services/liquidity/decrease/decrease-liquidity.js';
import type { LiquidityTxSummary } from '@npc/orca/services/liquidity/interfaces/liquidity-tx.interfaces.js';
import type { InstructionData, SendTransactionResult, TxSummary } from '@npc/solana';
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
   * The {@link EmptyPositionTxSummary}s for each successfully emptied {@link Position}.
   */
  successes: EmptyPositionTxSummary[];

}

/**
 * {@link InstructionData} for emptying a {@link Position} of its liquidity, fees, and rewards.
 */
export interface EmptyPositionIxData extends InstructionData {

  /**
   * The {@link CollectFeesRewardsIxData} for the collect fees and rewards instruction.
   */
  collectFeesRewardsIxData: CollectFeesRewardsIxData | undefined;

  /**
   * The {@link DecreaseLiquidityIxData} for the decrease liquidity (to 0) instruction.
   */
  decreaseLiquidityIxData: DecreaseLiquidityIxData | undefined;

}

/**
 * Summary of an empty {@link Position} transaction.
 */
export interface EmptyPositionTxSummary extends TxSummary {

  /**
   * The {@link BundledPosition} that was emptied.
   */
  position: Position;

  /**
   * The {@link CollectFeesRewardsTxSummary} for the collect fees and rewards transaction / instruction.
   *
   * `undefined` if there are no fees or rewards to collect.
   */
  collectFeesRewardsTxSummary: CollectFeesRewardsTxSummary | undefined;

  /**
   * The {@link LiquidityTxSummary} for the decrease liquidity transaction / instruction.
   *
   * `undefined` if there is no liquidity to decrease to zero.
   */
  decreaseLiquidityTxSummary: LiquidityTxSummary | undefined;

}

/**
 * Arguments for generating an {@link EmptyPositionTxSummary}.
 */
export interface EmptyPositionTxSummaryArgs {

  /**
   * The {@link EmptyPositionIxData} used to generate the summary.
   */
  emptyPositionIxData: EmptyPositionIxData;

  /**
   * The {@link Position} that was emptied.
   */
  position: Position;

  /**
   * The {@link SendTransactionResult} of the empty {@link Position} transaction.
   */
  sendResult: SendTransactionResult;

}
