import { TransactionBuilder } from '@orca-so/common-sdk';
import { Position, PositionBundleData } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

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
 * The unit to use for an amount of liquidity.
 */
export type LiquidityUnit = 'liquidity' | 'tokenA' | 'tokenB';
