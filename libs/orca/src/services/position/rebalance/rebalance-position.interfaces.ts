import type { LiquidityUnit } from '@npc/core';
import type { BundledPosition } from '@npc/orca/interfaces/position.interfaces';
import type { Address, Percentage } from '@orca-so/common-sdk';
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
export interface RebalanceAllPositionsResult {

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
   * The {@link RebalanceTxSummary}s for each successfully rebalanced {@link Position}.
   */
  successes: RebalanceTxSummary[];

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
   *
   * Defaults to the same liquidity amount initially deposited in the original {@link Position}.
   */
  liquidity?: Decimal | BN | number;

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

export interface RebalancePositionResult {

  /**
   * The {@link Position} that was rebalanced.
   */
  bundledPosition: BundledPosition;

  /**
   * The summary of the rebalance transaction.
   *
   * `undefined` if the transaction was skipped.
   */
  txSummary?: RebalanceTxSummary;

}

/**
 * A summary of a rebalance transaction for a {@link Position}.
 */
export interface RebalanceTxSummary {

  /**
   * The old {@link Position} that existed prior to the rebalance.
   */
  bundledPositionOld: BundledPosition;

  /**
   * The new {@link Position} that was created after the rebalance.
   */
  bundledPositionNew: BundledPosition;

}
