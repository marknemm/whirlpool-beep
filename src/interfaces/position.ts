import type { GetWhirlpoolCliArgs } from '@/interfaces/whirlpool';
import type { Address, TransactionBuilder } from '@orca-so/common-sdk';
import type { Position, PositionBundleData, WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';

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
 * CLI arguments for closing a {@link Position}.
 */
export interface ClosePositionCliArgs extends GetPositionCliArgs, GetWhirlpoolCliArgs {}

/**
 * CLI arguments for collecting fees and rewards from a {@link Position}.
 */
export interface CollectPositionCliArgs extends GetPositionCliArgs, GetWhirlpoolCliArgs {}

/**
 * CLI arguments for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityCliArgs extends GetPositionCliArgs, GetWhirlpoolCliArgs {

  /**
   * The amount of liquidity to decrease.
   */
  liquidity: number;

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

export interface IncreaseLiquidityCmdArgs extends GetPositionCliArgs, GetWhirlpoolCliArgs {

  /**
   * The amount of liquidity to provide.
   */
  liquidity: number;

  /**
   * The {@link LiquidityUnit} to use for the liquidity amount.
   */
  liquidityUnit: LiquidityUnit;

}

/**
 * The unit to use for an amount of liquidity.
 */
export type LiquidityUnit = 'liquidity' | 'tokenA' | 'tokenB';

/**
 * CLI arguments for opening a position.
 */
export interface OpenPositionCliArgs extends GetWhirlpoolCliArgs {

  /**
   * The amount of liquidity to provide.
   */
  liquidity?: number;

  /**
   * The {@link LiquidityUnit} to use for the liquidity amount.
   */
  liquidityUnit?: LiquidityUnit;

  /**
   * The price margin percentage to use for the {@link Position}.
   *
   * Should be a number between `0` and `100`.
   */
  priceMargin: number;

}

/**
 * Fetch options for fetching {@link Position}s.
 *
 * @augments WhirlpoolAccountFetchOptions
 */
export interface PositionsFetchOptions extends WhirlpoolAccountFetchOptions {

  /**
   * The {@link Address} of the {@link Whirlpool} to get {@link Position}s for.
   */
  whirlpoolAddress?: Address;

}
