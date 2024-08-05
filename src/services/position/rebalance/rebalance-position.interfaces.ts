import type { LiquidityUnit } from '@/interfaces/liquidity.interfaces';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import type { ClosePositionIx, ClosePositionTxSummary } from '@/services/position/close/close-position';
import type { OpenPositionIx, OpenPositionTxSummary } from '@/services/position/open/open-position';
import type { Address, Instruction, Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import type { Position } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * Options for rebalancing all {@link Position}s.
 *
 * @augments RebalancePositionOptions
 */
export interface RebalanceAllPositionsOptions extends RebalancePositionOptions {

  /**
   * The {@link Address} of the {@link Whirlpool} to rebalance all {@link Position}s in.
   */
  whirlpoolAddress?: Address;

}

/**
 * The result of rebalancing all {@link Position}s.
 */
export interface RebalanceAllPositionsSummary {

  /**
   * The {@link BundledPosition}s that failed during rebalancing.
   *
   * Each failed {@link BundledPosition} should be associated with an {@link Error} in the {@link errs} array.
   */
  failures: { bundledPosition: BundledPosition, err: unknown }[];

  /**
   * The {@link BundledPosition}s that were skipped during rebalancing.
   */
  skips: BundledPosition[];

  /**
   * The {@link RebalancePositionTxSummary}s for each successfully rebalanced {@link Position}.
   */
  successes: RebalancePositionTxSummary[];

}

/**
 * Options for rebalancing a {@link Position}.
 */
export interface RebalancePositionOptions {

  /**
   * The filter function to use for selecting which {@link Position}s to rebalance.
   *
   * @param position The {@link Position} to filter.
   * @returns A {@link Promise} that resolves to `true` if the {@link Position} should be rebalanced, `false` otherwise.
   */
  filter: (position: Position) => Promise<boolean>;

  /**
   * The amount of liquidity to deposit into each {@link Position} where rebalancing is required.
   */
  liquidity: Decimal | BN | number;

  /**
   * The {@link LiquidityUnit} to use for the liquidity amount.
   *
   * Defaults to `'usd'`.
   */
  liquidityUnit?: LiquidityUnit;

  /**
   * The price margin {@link Percentage} to use for the {@link Position}.
   *
   * Defaults to the same price margin of original {@link Position}.
   */
  priceMargin?: Percentage;

}

/**
 * {@link Instruction} data for rebalancing a {@link Position}.
 */
export interface RebalancePositionIx extends RebalancePositionIxTxAssocData {

  /**
   * The combined {@link Instruction} for rebalancing a {@link Position}.
   */
  ix: Instruction;

}

/**
 * Transaction data for rebalancing a {@link Position}.
 */
export interface RebalancePositionTx extends RebalancePositionIxTxAssocData {

  /**
   * The {@link TransactionBuilder} for the complete rebalance {@link Position} transaction.
   */
  tx: TransactionBuilder;

}

/**
 * Data associated with rebalance position transaction instructions and transactions.
 */
interface RebalancePositionIxTxAssocData {

  /**
   * {@link Instruction} data for closing the old {@link Position}.
   */
  closePositionIx: ClosePositionIx;

  /**
   * {@link Instruction} data for opening the new {@link Position}.
   */
  openPositionIx: OpenPositionIx;

}

/**
 * A summary of a rebalance transaction for a {@link Position}.
 */
export interface RebalancePositionTxSummary {

  /**
   * The summary of the close {@link Position} transaction.
   */
  closePositionTxSummary: ClosePositionTxSummary;

  /**
   * TThe fee (base + priority) for the close {@link Position} transaction.
   */
  fee: number;

  /**
   * The summary of the open {@link Position} transaction.
   */
  openPositionTxSummary: OpenPositionTxSummary;

  /**
   * The transaction signature for the rebalance {@link Position} transaction.
   */
  signature: string;

}

/**
 * Arguments for generating a {@link RebalancePositionTxSummary}.
 */
export interface RebalancePositionTxSummaryArgs {

  /**
   * The {@link BundledPosition} that was rebalanced.
   */
  bundledPosition: BundledPosition;

  /**
   * The {@link RebalancePositionIx} or {@link RebalancePositionTx} for the rebalance transaction.
   */
  rebalancePositionIxTx: RebalancePositionIx | RebalancePositionTx;

  /**
   * The transaction signature for the rebalance transaction.
   */
  signature: string;

}
