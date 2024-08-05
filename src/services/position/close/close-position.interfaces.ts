import type { Null } from '@/interfaces/nullable.interfaces';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import type { CollectFeesRewardsTxSummary } from '@/services/fees-rewards/collect/collect-fees-rewards.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import type { Instruction, TransactionBuilder } from '@orca-so/common-sdk';
import type { CollectFeesQuote, CollectRewardsQuote, DecreaseLiquidityQuote } from '@orca-so/whirlpools-sdk';

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
 * {@link Instruction} data for closing a {@link Position}.
 */
export interface ClosePositionIx extends ClosePositionIxTxAssocData {

  /**
   * The combined {@link Instruction} for preparing a {@link Position} to close and closing it.
   */
  ix: Instruction;

}

/**
 * Transaction data for closing a {@link Position}.
 */
export interface ClosePositionTx extends ClosePositionIxTxAssocData {

  /**
   * The {@link TransactionBuilder} for the complete close {@link Position} transaction.
   */
  tx: TransactionBuilder;

}

/**
 * Data associated with close position transaction instructions and transactions.
 */
interface ClosePositionIxTxAssocData {

  /**
   * The close {@link Position} {@link Instruction}.
   */
  closePositionIx: Instruction;

  /**
   * The {@link CollectFeesQuote} used to generate the collect fees {@link Instruction}.
   */
  collectFeesQuote: CollectFeesQuote | Null;

  /**
   * The collect fees {@link Instruction}.
   */
  collectFeesIx: Instruction | Null;

  /**
   * The {@link CollectRewardsQuote} used to generate the collect rewards {@link Instruction}.
   */
  collectRewardsQuote: CollectRewardsQuote | Null;

  /**
   * The collect rewards {@link Instruction}s.
   */
  collectRewardsIxs: Instruction[];

  /**
   * The {@link DecreaseLiquidityQuote} used to generate the decrease liquidity {@link Instruction}.
   */
  decreaseLiquidityQuote: DecreaseLiquidityQuote | Null;

  /**
   * The decrease liquidity {@link Instruction}.
   */
  decreaseLiquidityIx: Instruction | Null;

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
  signature: string;

}

/**
 * Arguments for generating a {@link ClosePositionTxSummary}.
 */
export interface ClosePositionTxSummaryArgs {

  /**
   * The {@link BundledPosition} to close.
   */
  bundledPosition: BundledPosition;

  /**
   * The {@link ClosePositionTx} used to generate the summary.
   */
  closePositionTx: ClosePositionTx;

  /**
   * The signature of the close {@link Position} transaction.
   */
  signature: string;

}
