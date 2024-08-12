import type { InstructionData } from '@/util/transaction-context/transaction-context';
import type { Address } from '@coral-xyz/anchor';
import type { DecreaseLiquidityQuote, Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * {@link DecreaseLiquidityIxData} for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityIxData extends InstructionData {

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
