import type { LiquidityUnit } from '@npc/orca/interfaces/liquidity.interfaces.js';
import type { BundledPosition } from '@npc/orca/interfaces/position.interfaces.js';
import type { IncreaseLiquidityIxData } from '@npc/orca/services/liquidity/increase/increase-liquidity.js';
import type { LiquidityTxSummary } from '@npc/orca/services/liquidity/interfaces/liquidity-tx.interfaces.js';
import type { InstructionData, SendTransactionResult, TxSummary } from '@npc/solana';
import type { PDA, Percentage } from '@orca-so/common-sdk';
import type { Position, PositionBundleData, Whirlpool } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';
import type BN from 'bn.js';
import type { Decimal } from 'decimal.js';

/**
 * Instruction data and associate metadata for opening a {@link Position}.
 */
export interface OpenPositionIxData extends InstructionData {

  /**
   * The {@link IncreaseLiquidityIxData} for increasing liquidity in the new position.
   */
  increaseLiquidityIxData: IncreaseLiquidityIxData | undefined;

  /**
   * The {@link PositionInitData} for the new {@link Position}.
   */
  positionInitData: PositionInitData;

  /**
   * The price margin {@link Percentage} that was used when opening the new {@link Position}.
   */
  priceMargin: Percentage;

  /**
   * The {@link Whirlpool} that the new {@link Position} is in.
   */
  whirlpool: Whirlpool;

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
export interface OpenPositionTxSummary extends TxSummary {

  /**
   * The {@link BundledPosition} that was opened.
   */
  bundledPosition: BundledPosition;

  /**
   * The {@link LiquidityTxSummary} for the increase liquidity transaction.
   *
   * `undefined` if the transaction was excluded.
   */
  increaseLiquidityTxSummary?: LiquidityTxSummary;

  /**
   * The price margin {@link Percentage} for the new {@link Position}.
   */
  priceMargin: Percentage;

  /**
   * The price range for the new {@link Position}.
   */
  priceRange: [Decimal, Decimal];

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
   * The {@link OpenPositionIxData} used to generate the summary.
   */
  openPositionIxData: OpenPositionIxData;

  /**
   * The {@link SendTransactionResult} of the open {@link Position} transaction.
   */
  sendResult: SendTransactionResult;

}

/**
 * The data pertaining to initialization of the {@link Position} that is being opened.
 */
export interface PositionInitData {

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
