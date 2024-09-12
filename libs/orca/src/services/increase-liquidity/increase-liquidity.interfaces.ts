import type { Address } from '@coral-xyz/anchor';
import type { LiquidityUnit } from '@npc/core';
import type { InstructionSet, TxSummary } from '@npc/solana';
import type { IncreaseLiquidityQuote, Position, Whirlpool } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * The arguments for generating a transaction instruction to increase liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityArgs {

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
   * The {@link Address} of the mint account of the {@link Position} to increase the liquidity of.
   */
  positionMint: Address;

  /**
   * The tick index range for the {@link Position}.
   */
  tickRange: [number, number];

  /**
   * The {@link Address} of the {@link Whirlpool} containing the {@link Position} to increase the liquidity of.
   */
  whirlpool: Whirlpool | Address;

}

/**
 * Instruction data for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityData extends IncreaseLiquidityQuote {

  /**
   * The {@link Address} of the {@link Position} to increase the liquidity of.
   */
  positionAddress: Address;

  /**
   * The token mint pair of the {@link Position}.
   */
  tokenMintPair: [Address, Address];

  /**
   * The {@link Address} of the {@link Whirlpool} containing the {@link Position} to increase the liquidity of.
   */
  whirlpoolAddress: Address;

}

/**
 * The {@link InstructionSet} for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityIxSet extends InstructionSet {

  /**
   * The {@link IncreaseLiquidityData} for the increase liquidity transaction.
   */
  data: IncreaseLiquidityData;

}

/**
 * The {@link TxSummary} for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquiditySummary extends TxSummary {

  /**
   * The {@link IncreaseLiquidityData} for the increase liquidity transaction.
   */
  data: IncreaseLiquidityData;

}
