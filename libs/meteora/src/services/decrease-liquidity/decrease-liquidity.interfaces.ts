import type { Address, BN } from '@coral-xyz/anchor';
import type DLMM from '@meteora-ag/dlmm';
import type { Position } from '@npc/meteora/util/position/position';
import type { InstructionSetMap } from '@npc/solana';
import type Decimal from 'decimal.js';

/**
 * The arguments for decreasing liquidity evenly across all positions in a given pool.
 */
export interface DecreasePoolLiquidityArgs {

  /**
   * The {@link Address} of the Meteora {@link DLMM} pool to decrease liquidity in.
   */
  poolAddress: Address;

  /**
   * The total amount of liquidity to withdraw from the Meteora {@link DLMM} pool.
   */
  liquidity: BN | Decimal.Value;

}

/**
 * The arguments for generating a transaction instruction to decrease liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityArgs {

  /**
   * The amount of liquidity to remove from the {@link Position}.
   */
  liquidity: BN | Decimal.Value;

  /**
   * The {@link Address} of the {@link Position} to withdraw the liquidity from.
   */
  positionAddress: Address;

}

/**
 * {@link DecreaseLiquidityIxData} for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityIxData extends DecreaseLiquidityArgs, InstructionSetMap {

  /**
   * The {@link Address} of the {@link Whirlpool} containing the {@link Position} to decrease the liquidity of.
   */
  poolAddress: Address;

}