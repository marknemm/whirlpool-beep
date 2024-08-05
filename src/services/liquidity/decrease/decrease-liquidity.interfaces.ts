import type { Instruction, TransactionBuilder } from '@orca-so/common-sdk';
import type { DecreaseLiquidityQuote } from '@orca-so/whirlpools-sdk';

/**
 * {@link Instruction} data for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityIx extends DecreaseLiquidityIxTxAssocData {

  /**
   * The {@link Instruction} for decreasing liquidity in a {@link Position}.
   */
  ix: Instruction;

}

/**
 * Transaction data for decreasing liquidity in a {@link Position}.
 */
export interface DecreaseLiquidityTx extends DecreaseLiquidityIxTxAssocData {

  /**
   * The {@link TransactionBuilder} for decreasing liquidity in a {@link Position}.
   */
  tx: TransactionBuilder;

}

/**
 * Data associated with decrease liquidity transaction instructions and transactions.
 */
interface DecreaseLiquidityIxTxAssocData {

  /**
   * The {@link DecreaseLiquidityQuote} used to generate the transaction.
   */
  quote: DecreaseLiquidityQuote;

}
