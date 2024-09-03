import type { Address } from '@coral-xyz/anchor';
import type { LiquidityUnit } from '@npc/core';
import type { Position } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * The arguments for generating a transaction instruction to increase liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityIxArgs {

  /**
   * The amount of liquidity to add to the {@link Position}.
   */
  liquidity: BN | Decimal.Value;

  /**
   * The {@link LiquidityUnit} of the {@link liquidity}.
   */
  liquidityUnit?: LiquidityUnit;

  /**
   * The {@link Address} of the {@link Position} to deposit the liquidity into.
   */
  positionAddress: Address;

  /**
   * The {@link Address} of the {@link DLMM} pool to increase the liquidity of.
   */
  poolAddress: Address;

}

/**
 * Instruction data for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityIxData extends IncreaseLiquidityAmounts {

  /**
   * The arguments used to generate the instruction data.
   */
  ixArgs: IncreaseLiquidityIxArgs;

}

/**
 * The amount of token X and Y to deposit into a {@link Position}.
 */
export interface IncreaseLiquidityAmounts {

  /**
   * The total amount of token X to deposit into the {@link Position}.
   */
  totalXAmount: BN;

  /**
   * The total amount of token Y to deposit into the {@link Position}.
   */
  totalYAmount: BN;

}
