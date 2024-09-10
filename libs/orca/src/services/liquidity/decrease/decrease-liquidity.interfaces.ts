import type { Address, BN } from '@coral-xyz/anchor';
import type { InstructionSetMap } from '@npc/solana';
import type { DecreaseLiquidityQuote, Position, Whirlpool } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * The arguments for generating a transaction instruction to decrease liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityIxArgs {

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
 * {@link DecreaseLiquidityIxData} for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityIxData extends InstructionSetMap {

  /**
   * The arguments used to generate the instruction data.
   */
  ixArgs: DecreaseLiquidityIxArgs;

  /**
   * The {@link Address} of the {@link Position} to decrease the liquidity of.
   */
  positionAddress: Address;

  /**
   * The {@link DecreaseLiquidityQuote} used to generate the transaction.
   */
  quote: DecreaseLiquidityQuote;

  /**
   * The {@link Address} of the {@link Whirlpool} containing the {@link Position} to decrease the liquidity of.
   */
  whirlpoolAddress: Address;

}
