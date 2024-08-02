import type { Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import type { PositionBundleData, Whirlpool } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';

export interface OpenPositionOptions {

  /**
   * The amount to bump the {@link Position} index by to prevent collision when opening multiple positions in parallel.
   *
   * @default 0
   */
  bumpIndex?: number;

  /**
   * The bundle index of the {@link Position} to open.
   * If not provided, the next available bundle index will be used.
   */
  bundleIndex?: number;

  /**
   * The price margin {@link Percentage} to use for the {@link Position}.
   *
   * @default Percentage.fromFraction(3, 100)
   */
  priceMargin?: Percentage;

  /**
   * The {@link Whirlpool} to open a {@link Position} in.
   */
  whirlpool: Whirlpool;

}

/**
 * The return type of `genOpenPositionTx` function.
 */
export interface GenOpenPositionTxReturn {

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
