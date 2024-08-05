import type { LiquidityUnit } from '@/interfaces/liquidity.interfaces';
import type { Address, Instruction, TransactionBuilder } from '@orca-so/common-sdk';
import type { IncreaseLiquidityQuote, Position, Whirlpool } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * {@link Instruction} data for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityIx extends IncreaseLiquidityIxTxAssocData {

  /**
   * The {@link Instruction} for increasing liquidity in a {@link Position}.
   */
  ix: Instruction;

}

/**
 * Transaction data for increasing liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityTx extends IncreaseLiquidityIxTxAssocData {

  /**
   * The {@link TransactionBuilder} for increasing liquidity in a {@link Position}.
   */
  tx: TransactionBuilder;

}

/**
 * Data associated with increase liquidity transaction instructions and transactions.
 */
interface IncreaseLiquidityIxTxAssocData {

  /**
   * The {@link IncreaseLiquidityQuote} used to generate the transaction.
   */
  quote: IncreaseLiquidityQuote;

}

/**
 * The arguments for generating a transaction to increase liquidity in a {@link Position}.
 */
export interface IncreaseLiquidityTxArgs {

  /**
   * The amount of liquidity to add to the {@link Position}.
   */
  amount: BN | Decimal.Value;

  /**
   * The {@link LiquidityUnit} of the liquidity {@link amount}.
   */
  unit?: LiquidityUnit;

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
