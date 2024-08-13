import type { LiquidityUnit } from '@/interfaces/liquidity.interfaces';
import type { InstructionData } from '@/util/transaction-context/transaction-context';
import type { Address } from '@coral-xyz/anchor';
import type { IncreaseLiquidityQuote, Position, Whirlpool } from '@orca-so/whirlpools-sdk';
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
   * The {@link Address} of the mint account of the {@link Position} to increase the liquidity of.
   */
  positionMint: Address;

  /**
   * The tick index range for the {@link Position}.
   */
  tickRange: [number, number];

  /**
   * The {@link Whirlpool} containing the {@link Position} to increase the liquidity of.
   */
  whirlpool: Whirlpool;

}

/**
 * Instruction data for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityIxData extends InstructionData {

  /**
   * The arguments used to generate the instruction data.
   */
  ixArgs: IncreaseLiquidityIxArgs;

  /**
   * The {@link Address} of the {@link Position} to increase the liquidity of.
   */
  positionAddress: Address;

  /**
   * The {@link IncreaseLiquidityQuote} used to generate the transaction.
   */
  quote: IncreaseLiquidityQuote;

  /**
   * The {@link Whirlpool} containing the {@link Position} to increase the liquidity of.
   */
  whirlpool: Whirlpool;

}
