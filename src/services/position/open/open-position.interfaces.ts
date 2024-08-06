import type { LiquidityUnit } from '@/interfaces/liquidity.interfaces';
import type { Null } from '@/interfaces/nullable.interfaces';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import type { Instruction, PDA, Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import type { IncreaseLiquidityQuote, Position, PositionBundleData, Whirlpool } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';
import type BN from 'bn.js';
import type Decimal from 'decimal.js';

/**
 * The data pertaining to the {@link Position} that is being opened.
 */
export interface OpenPositionData {

  /**
   * The {@link PublicKey} address of the new {@link Position}.
   */
  address: PublicKey;

  /**
   * The bundle index of the new {@link Position}.
   */
  bundleIndex: number;

  /**
   * The {@link PDA} for the new bundled {@link Position}.
   */
  bundledPositionPda: PDA;

  /**
   * The {@link PositionBundleData PositionBundle} that will contain the new {@link Position}.
   */
  positionBundle: PositionBundleData;

  /**
   * The {@link PDA} for the new {@link Position}'s bundle.
   */
  positionBundlePda: PDA;

  /**
   * The price margin {@link Percentage} for the new {@link Position}.
   */
  priceMargin: Percentage;

  /**
   * The computed price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

  /**
   * The computed tick range for the new {@link Position}.
   */
  tickRange: [number, number];

  /**
   * The {@link Whirlpool} that the new {@link Position} is in.
   */
  whirlpool: Whirlpool;

}

/**
 * Instruction data for opening a {@link Position}.
 */
export interface OpenPositionIx extends OpenPositionIxTxAssocData {

  /**
   * The combined {@link Instruction} for opening a new {@link Position} and increasing its liquidity.
   */
  ix: Instruction;

}

/**
 * Transaction data for opening a {@link Position}.
 */
export interface OpenPositionTx extends OpenPositionIxTxAssocData{

  /**
   * The {@link TransactionBuilder} for creating the new {@link Position}.
   */
  tx: TransactionBuilder;

}

/**
 * Data associated with open position transaction instructions and transactions.
 */
interface OpenPositionIxTxAssocData {

  /**
   * The {@link IncreaseLiquidityQuote} for increasing liquidity in the new {@link Position}.
   */
  increaseLiquidityQuote: IncreaseLiquidityQuote | Null;

  /**
   * The {@link Instruction} for increasing liquidity in the new {@link Position}.
   */
  increaseLiquidityIx: Instruction | Null;

  /**
   * The {@link OpenPositionData} for the new {@link Position}.
   */
  openPositionData: OpenPositionData;

  /**
   * The {@link Instruction} for opening the new {@link Position}.
   */
  openPositionIx: Instruction;

}

/**
 * Options for opening a {@link Position}.
 */
export interface OpenPositionOptions {

  /**
   * The amount to bump the {@link Position} index by to prevent collision when opening multiple positions in parallel.
   *
   * @default 0
   */
  bumpIndex?: number;

  /**
   * The bundle index of the {@link Position} to open.
   * If not provided, the next available bundle index will be used.
   */
  bundleIndex?: number;

  /**
   * The initial amount of liquidity to provide for the {@link Position}.
   */
  liquidity?: BN | Decimal.Value;

  /**
   * The {@link LiquidityUnit} to use for the initial liquidity in the {@link Position}.
   *
   * @default `'usd'`
   */
  liquidityUnit?: LiquidityUnit;

  /**
   * The price margin {@link Percentage} to use for the {@link Position}.
   *
   * @default Percentage.fromFraction(3, 100)
   */
  priceMargin?: Percentage;

  /**
   * The {@link Whirlpool} to open a {@link Position} in.
   */
  whirlpool: Whirlpool;

}

/**
 * The summary of an open position transaction.
 */
export interface OpenPositionTxSummary {

  /**
   * The {@link BundledPosition} that was opened.
   */
  bundledPosition: BundledPosition;

  /**
   * The fee (base + priority) for the open position transaction.
   */
  fee: number;

  /**
   * The {@link LiquidityTxSummary} for the increase liquidity transaction.
   *
   * `undefined` if the transaction was excluded.
   */
  liquidityTxSummary?: LiquidityTxSummary;

  /**
   * The price margin {@link Percentage} for the new {@link Position}.
   */
  priceMargin: Percentage;

  /**
   * The price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

  /**
   * The signature of the open position transaction.
   */
  signature: string;

  /**
   * The tick index range for the new {@link Position}.
   */
  tickRange: [number, number];

}

/**
 * Arguments for generating a {@link OpenPositionTxSummary}.
 */
export interface OpenPositionTxSummaryArgs {

  /**
   * The {@link BundledPosition} that was opened.
   */
  bundledPosition: BundledPosition;

  /**
   * The {@link OpenPositionIx} or {@link OpenPositionTx} used to generate the summary.
   */
  openPositionIxTx: OpenPositionTx | OpenPositionIx;

  /**
   * The signature of the open {@link Position} transaction.
   */
  signature: string;

}
