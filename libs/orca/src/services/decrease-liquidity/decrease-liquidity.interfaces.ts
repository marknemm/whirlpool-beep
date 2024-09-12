import type { Address, BN } from '@coral-xyz/anchor';
import type { InstructionSet, TxSummary } from '@npc/solana';
import type { DecreaseLiquidityQuote, Position, Whirlpool } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

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
  position: Position;

}

/**
 * Metadata for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityData extends DecreaseLiquidityQuote {

  /**
   * The {@link Address} of the {@link Position} to decrease the liquidity of.
   */
  positionAddress: Address;

  /**
   * The token mint pair of the {@link Position}.
   */
  tokenMintPair: [Address, Address];

  /**
   * The {@link Address} of the {@link Whirlpool} containing the {@link Position} to decrease the liquidity of.
   */
  whirlpoolAddress: Address;

}

/**
 * The {@link InstructionSet} for increasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityIxSet extends InstructionSet {

  /**
   * The {@link DecreaseLiquidityData} for the increase liquidity transaction.
   */
  data: DecreaseLiquidityData;

}

/**
 * The {@link TxSummary} for increasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquiditySummary extends TxSummary {

  /**
   * The {@link DecreaseLiquidityData} for the increase liquidity transaction.
   */
  data: DecreaseLiquidityData;

}
