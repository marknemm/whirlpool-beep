import type { Address } from '@coral-xyz/anchor';
import type { StrategyParameters } from '@meteora-ag/dlmm';
import type { Position } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

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

/**
 * Arguments for generating increase liquidity token X and Y amounts.
 */
export interface IncreaseLiquidityAmountsArgs {

  /**
   * The amount of liquidity to add to the {@link Position}.
   */
  liquidity: BN | Decimal.Value;

  /**
   * The unit of the {@link liquidity}.
   */
  liquidityUnit?: string;

  /**
   * The {@link Address} of the {@link DLMM} pool to increase the liquidity of.
   */
  poolAddress: Address;

}

/**
 * Arguments for generating a transaction instruction to increase liquidity in a {@link Position}.
 *
 * @augments GenIncreaseLiquidityAmountsArgs
 */
export interface IncreaseLiquidityArgs extends IncreaseLiquidityAmountsArgs {

  /**
   * The {@link Address} of the {@link Position} to deposit the liquidity into.
   */
  positionAddress: Address;

  /**
   * The {@link StrategyParameters} for the liquidity increase.
   *
   * `IMPORTANT`: Required if the position has not been initialized yet.
   *
   * @default genDefaultLiquidityStrategy(positionAddress)
   */
  strategy?: StrategyParameters;

}
