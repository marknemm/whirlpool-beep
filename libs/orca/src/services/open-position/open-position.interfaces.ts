import type { Address } from '@coral-xyz/anchor';
import type { LiquidityUnit } from '@npc/core';
import type { IncreaseLiquidityData } from '@npc/orca/services/increase-liquidity/increase-liquidity.interfaces';
import type { InstructionSet, TxSummary } from '@npc/solana';
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
 * The data for opening a new {@link Position}.
 */
export interface OpenPositionData {

  /**
   * The bundle index of the new {@link Position}.
   */
  bundleIndex: number;

  /**
   * {@link IncreaseLiquidityData} for the new {@link Position}.
   * If the {@link Position} was opened with liquidity, this will be set.
   */
  increaseLiquidityData?: IncreaseLiquidityData;

  /**
   * The {@link Address} of the new {@link Position}.
   */
  positionAddress: Address;

  /**
   * The {@link Address} for the new {@link Position}'s bundle.
   */
  positionBundle: Address;

  /**
   * The {@link Address} of the new {@link Position}'s mint.
   */
  positionMint: Address;

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
  whirlpoolAddress: Address;

}

/**
 * The {@link InstructionSet} for opening a new {@link Position}.
 */
export interface OpenPositionIxSet extends InstructionSet {

  /**
   * The {@link OpenPositionData} for the open position transaction.
   */
  data: OpenPositionData;

}

/**
 * The {@link TxSummary} for opening a new {@link Position}.
 */
export interface OpenPositionSummary extends TxSummary {

  /**
   * The {@link OpenPositionData} for the open position transaction.
   */
  data: OpenPositionData;

}
