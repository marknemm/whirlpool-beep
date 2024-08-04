import { LiquidityUnit } from '@/interfaces/liquidity.interfaces';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import type { Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import type { Position, PositionBundleData, Whirlpool } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type Decimal from 'decimal.js';

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
   * The computed price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

  /**
   * The computed tick range for the new {@link Position}.
   */
  tickRange: [number, number];

  /**
   * The {@link TransactionBuilder} for creating the new {@link Position}.
   */
  tx: TransactionBuilder;

}

/**
 * Options for opening a {@link Position}.
 */
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
   * The initial amount of liquidity to provide for the {@link Position}.
   */
  liquidity?: BN | Decimal.Value;

  /**
   * The {@link LiquidityUnit} to use for the initial liquidity in the {@link Position}.
   *
   * @default `'usd'`
   */
  liquidityUnit?: LiquidityUnit;

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
 * The summary of an open position transaction.
 */
export interface OpenPositionTxSummary {

  /**
   * The {@link BundledPosition} that was opened.
   */
  bundledPosition: BundledPosition;

  /**
   * The fee (base + priority) for the open position transaction.
   */
  fee: number;

  /**
   * The {@link LiquidityTxSummary} for the increase liquidity transaction.
   *
   * `undefined` if the transaction was excluded.
   */
  liquidityTxSummary?: LiquidityTxSummary;

  /**
   * The signature of the open position transaction.
   */
  signature: string;

}
