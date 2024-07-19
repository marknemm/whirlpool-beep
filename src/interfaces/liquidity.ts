import type { Position, DecreaseLiquidityQuote, IncreaseLiquidityQuote } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';

/**
 * Record of liquidity within a {@link Position}.
 */
export interface Liquidity {

  /**
   * The {@link Position} that the liquidity delta is for.
   */
  position: Position;

  /**
   * The quote for the liquidity change.
   */
  quote?: DecreaseLiquidityQuote | IncreaseLiquidityQuote;

  /**
   * The signature of the transaction that changed the liquidity.
   */
  signature: string;

  /**
   * The amount of token A that was added or removed.
   */
  tokenAmountA: BN;

  /**
   * The amount of token B that was added or removed.
   */
  tokenAmountB: BN;

  /**
   * The USD value of the liquidity change.
   */
  usd: number;

}

/**
 * The unit to use for an amount of liquidity.
 */
export type LiquidityUnit = 'liquidity' | 'tokenA' | 'tokenB' | 'usd';
