import type { LiquidityUnit } from '@/interfaces/liquidity';
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
   * Defaults to `3%`.
   */
  priceMargin?: Percentage;

}

/**
 * A summary of a rebalance transaction for a {@link Position}.
 */
export interface RebalanceTxSummary {

  /**
   * The old {@link Position} that existed prior to the rebalance.
   */
  positionOld: Position;

  /**
   * The new {@link Position} that was created after the rebalance.
   */
  positionNew: Position;

}
