import type { BN } from '@coral-xyz/anchor';
import type { Address, Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import type { Position, PositionBundleData, WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

/**
 * A bundled {@link Position}.
 */
export interface BundledPosition {

  /**
   * The index of the {@link Position} in the {@link PositionBundleData}.
   */
  bundleIndex: number;

  /**
   * The {@link Position} itself.
   */
  position: Position;

  /**
   * The {@link PositionBundleData} containing the {@link Position}.
   */
  positionBundle: PositionBundleData;

}

/**
 * The return type of `genOpenPositionTx` function.
 */
export interface GenOptionPositionTxReturn {

  /**
   * The {@link PublicKey} address of the new {@link Position}.
   */
  address: PublicKey;

  /**
   * The bundle index of the new {@link Position}.
   */
  bundleIndex: number;

  /**
   * The {@link PositionBundleData PositionBundle} that will contain the new {@link Position}.
   */
  positionBundle: PositionBundleData;

  /**
   * The {@link TransactionBuilder} for creating the new {@link Position}.
   */
  tx: TransactionBuilder;

}

/**
 * CLI arguments for getting a {@link Position}.
 */
export interface GetPositionCliArgs {

  /**
   * The bundle index of the {@link Position} to get.
   */
  bundleIndex?: number;

  /**
   * The address of the {@link Position} to get.
   */
  position?: string;

}

/**
 * The unit to use for an amount of liquidity.
 */
export type LiquidityUnit = 'liquidity' | 'tokenA' | 'tokenB';

export interface RebalanceAllPositionsOptions extends RebalancePositionOptions {

  /**
   * The {@link Address} of the {@link Whirlpool} to rebalance all {@link Position}s in.
   */
  whirlpoolAddress?: Address;

}

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
   * Defaults to `'tokenB'`.
   */
  liquidityUnit?: LiquidityUnit;

  /**
   * The price margin {@link Percentage} to use for the {@link Position}.
   * Defaults to `3%`.
   */
  priceMargin?: Percentage;

}

/**
 * Options for getting {@link Position}s.
 *
 * @augments WhirlpoolAccountFetchOptions
 */
export interface GetPositionsOptions extends WhirlpoolAccountFetchOptions {

  /**
   * The {@link Address} of the {@link Whirlpool} to get {@link Position}s for.
   */
  whirlpoolAddress?: Address;

}
