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

/**
 * The status of a {@link Position}.
 */
export type PositionStatus = 'CLOSED' | 'OPENED';
