import type { LiquidityUnit } from '@npc/core';
import type { TxSummary } from '@npc/solana';
import type { Position } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';

/**
 * Summary of a liquidity transaction for a {@link Position}.
 */
export interface LiquidityTxSummary extends TxSummary {

  /**
   * The amount of liquidity that was increased or decreased in terms of {@link liquidityUnit}.
   */
  liquidity: BN;

  /**
   * The {@link LiquidityUnit} of the {@link liquidity} amount.
   */
  liquidityUnit: LiquidityUnit;

  /**
   * The {@link Position} that the liquidity is associated with.
   */
  position: Position;

  /**
   * The slippage decimal/percentage value of the transaction.
   */
  slippage: number;

  /**
   * The amount of token A that was increased or decreased.
   */
  tokenAmountA: BN;

  /**
   * The amount of token B that was increased or decreased.
   */
  tokenAmountB: BN;

}
