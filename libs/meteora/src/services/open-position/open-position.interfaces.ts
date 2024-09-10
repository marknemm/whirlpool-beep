import type { Address } from '@coral-xyz/anchor';
import type DLMM from '@meteora-ag/dlmm';
import type { LiquidityTxSummary } from '@npc/meteora/interfaces/liquidity.interfaces';
import type { Position } from '@npc/meteora/util/position/position';
import type { SendTransactionResult, TransactionContext, TxSummary } from '@npc/solana';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * Arguments for opening a new {@link Position} in a Meteora liquidity pool.
 */
export interface OpenPositionArgs {

  /**
   * The initial amount of liquidity to provide for the {@link Position}.
   */
  liquidity?: BN | Decimal.Value;

  /**
   * The liquidity unit to use for the initial liquidity in the {@link Position}.
   * Can be `'usd'` or either of the token symbols.
   *
   * @default `'usd'`
   */
  liquidityUnit?: string;

  /**
   * The price margin to use when opening the new {@link Position}.
   */
  priceMargin?: Decimal.Value;

  /**
   * The {@link Address} of the Meteora liquidity pool that the new {@link Position} is in.
   */
  poolAddress: Address;

}

/**
 * Instruction data and associate metadata for opening a {@link Position}.
 */
export interface OpenPositionTxCtx{

  /**
   * The bin index range for the new {@link Position}.
   */
  binRange: [number, number];

  /**
   * The Meteora {@link DLMM} pool that the new {@link Position} is in.
   */
  pool: DLMM;

  /**
   * The price margin {@link Decimal} that was used when opening the new {@link Position}.
   */
  priceMargin: Decimal;

  /**
   * The origin price used to generate the position price range.
   */
  priceOrigin: Decimal;

  /**
   * The price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

  /**
   * The transaction context for the open position transaction.
   */
  transactionCtx: TransactionContext;

}

/**
 * The summary of a Meteora open position transaction.
 */
export interface OpenPositionTxSummary extends TxSummary {

  /**
   * The bin index range for the new {@link Position}.
   */
  binRange: [number, number];

  /**
   * The {@link Position} that was opened.
   */
  position: Position;

  /**
   * The {@link LiquidityTxSummary} for the increase liquidity transaction.
   *
   * `undefined` if the transaction was excluded.
   */
  increaseLiquidityTxSummary?: LiquidityTxSummary;

  /**
   * The price margin {@link Decimal} for the new {@link Position}.
   */
  priceMargin: Decimal;

  /**
   * The origin price used to generate the position price range.
   */
  priceOrigin: Decimal;

  /**
   * The price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

}

/**
 * Arguments for generating a {@link OpenPositionTxSummary}.
 */
export interface OpenPositionTxSummaryArgs {

  /**
   * The {@link Position} that was opened.
   */
  position: Position;

  /**
   * The {@link OpenPositionIxData} used to generate the summary.
   */
  openPositionIxData: OpenPositionIxData;

  /**
   * The {@link SendTransactionResult} of the open {@link Position} transaction.
   */
  sendResult: SendTransactionResult;

}
