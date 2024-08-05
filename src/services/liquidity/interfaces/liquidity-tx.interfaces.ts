import type { Null } from '@/interfaces/nullable.interfaces';
import type { Position, DecreaseLiquidityQuote, IncreaseLiquidityQuote } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';

/**
 * Summary of a liquidity transaction for a {@link Position}.
 */
export interface LiquidityTxSummary {

  /**
   * The fee paid for the transaction in lamports.
   */
  fee: number;

  /**
   * The {@link Position} that the liquidity is associated with.
   */
  position: Position;

  /**
   * The quote for the liquidity change.
   */
  quote: DecreaseLiquidityQuote | IncreaseLiquidityQuote | Null;

  /**
   * The signature of the transaction.
   */
  signature: string;

  /**
   * The amount of token A that was increased or decreased.
   */
  tokenAmountA: BN;

  /**
   * The amount of token B that was increased or decreased.
   */
  tokenAmountB: BN;

  /**
   * The total USD value of the liquidity change.
   */
  usd: number;

}
