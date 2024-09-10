import type { Address } from '@coral-xyz/anchor';
import type { LiquidityUnit } from '@npc/core';
import type { InstructionSet, TransactionContext, TxSummary } from '@npc/solana';
import type { Percentage } from '@orca-so/common-sdk';
import type { Position, Whirlpool } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * Arguments for opening a {@link Position}.
 */
export interface OpenPositionArgs {

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
   * The {@link Whirlpool} or {@link Address} of the {@link Whirlpool} to open a {@link Position} in.
   */
  whirlpool: Address | Whirlpool;

}

/**
 * The metadata for opening a new {@link Position}.
 */
export interface OpenPositionMetadata {

  /**
   * The bundle index of the new {@link Position}.
   */
  bundleIndex: number;

  /**
   * The {@link Address} of the new {@link Position}.
   */
  position: Address;

  /**
   * The {@link Address} for the new {@link Position}'s bundle.
   */
  positionBundle: Address;

  /**
   * The price margin {@link Percentage} for the new {@link Position}.
   */
  priceMargin: Percentage;

  /**
   * The computed price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

  /**
   * The computed tick range for the new {@link Position}.
   */
  tickRange: [number, number];

  /**
   * The {@link Address} of the {@link Whirlpool} that the new {@link Position} is in.
   */
  whirlpool: Address;

}

export type OpenPositionIxSet = InstructionSet<OpenPositionMetadata>;

export type OpenPositionTxCtx = TransactionContext<{
  openPosition: OpenPositionIxSet;
  increaseLiquidity: InstructionSet;
}>;

/**
 * The summary of an open position transaction.
 */
export type OpenPositionTxSummary = TxSummary<OpenPositionTxCtx>;
