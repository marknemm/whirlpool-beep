import { debug, error, expBackoff, info, toNum } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao.js';
import type { LiquidityUnit } from '@npc/orca/interfaces/liquidity.interfaces.js';
import type { BundledPosition } from '@npc/orca/interfaces/position.interfaces.js';
import { genIncreaseLiquidityIxData, genIncreaseLiquidityTxSummary, type IncreaseLiquidityIxData } from '@npc/orca/services/liquidity/increase/increase-liquidity.js';
import { getPositionBundle } from '@npc/orca/services/position-bundle/query/query-position-bundle.js';
import { toPriceRange, toTickRange } from '@npc/orca/util/tick-range/tick-range.js';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolPrice } from '@npc/orca/util/whirlpool/whirlpool.js';
import { getProgramErrorInfo, getTxSummary, TransactionContext, wallet } from '@npc/solana';
import { Percentage, TransactionBuilder, type Instruction } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type BN from 'bn.js';
import type { Decimal } from 'decimal.js';
import type { OpenPositionIxData, OpenPositionOptions, OpenPositionTxSummary, OpenPositionTxSummaryArgs, PositionInitData } from './open-position.interfaces.js';

const PRICE_MARGIN_DEFAULT = Percentage.fromFraction(3, 100); // 3%

/**
 * Opens a {@link Position} in a {@link Whirlpool}.
 *
 * @param options The {@link OpenPositionOptions}.
 * @returns A {@link Promise} that resolves to the newly opened {@link Position}.
 */
export async function openPosition(options: OpenPositionOptions): Promise<OpenPositionTxSummary> {
  const transactionCtx = new TransactionContext();

  const {
    whirlpool,
    priceMargin = PRICE_MARGIN_DEFAULT
  } = options;

  const opMetadata = {
    whirlpool: whirlpool.getAddress().toBase58(),
    priceMargin: priceMargin.toString(),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Open Position --\n', opMetadata);

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await whirlpool.refreshData();
      }

      const openPositionIxData = await genOpenPositionIxData(options);

      const {
        address,
        bundleIndex,
        positionBundle,
      } = openPositionIxData.positionInitData;

      // Prepare and send transaction to open position
      const sendResult = await transactionCtx.resetInstructionData(
        openPositionIxData,
        openPositionIxData.increaseLiquidityIxData
      ).send();

      // Get, store, and return the open position transaction summary
      const position = await expBackoff(() => whirlpoolClient().getPosition(address, IGNORE_CACHE));
      const bundledPosition: BundledPosition = { bundleIndex, position, positionBundle };
      const txSummary = await genOpenPositionTxSummary({
        bundledPosition,
        openPositionIxData,
        sendResult,
      });
      await OrcaPositionDAO.insert(txSummary, { catchErrors: true });
      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'TokenMaxExceeded'].includes(errInfo?.name ?? '');
      }
    });
  } catch (err) {
    const errInfo = getProgramErrorInfo(err);
    (errInfo?.code === 0x0) // New position address clash
      ? error('Failed to open position due to address clash:', opMetadata)
      : error('Failed to open position:', opMetadata);
    throw err;
  }
}

/**
 * Generates {@link OpenPositionIxData} for opening a {@link Position} in a {@link Whirlpool}.
 *
 * @param options The {@link OpenPositionOptions}.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genOpenPositionIxData(options: OpenPositionOptions): Promise<OpenPositionIxData> {
  const {
    whirlpool,
    priceMargin = PRICE_MARGIN_DEFAULT,
    liquidity,
    liquidityUnit
  } = options;

  info('Creating instructions to open position:', {
    whirlpool: await formatWhirlpool(whirlpool),
    priceMargin: priceMargin.toString(),
  });

  const positionInitData = await _genPositionInitData(options);
  const openPositionIx = await _genOpenPositionIx(positionInitData);
  const { address, bundleIndex, positionBundle, priceRange, tickRange } = positionInitData;

  info('Created instruction to open position:', {
    whirlpool: await formatWhirlpool(whirlpool),
    position: address.toBase58(),
    priceRange,
    tickRange,
  });

  // Add instruction to increase liquidity if specified
  let increaseLiquidityIxData: IncreaseLiquidityIxData | undefined;
  if (liquidity) {
    increaseLiquidityIxData = await _genIncreaseLiquidityIxData(liquidity, liquidityUnit, positionInitData);
  }

  return {
    ...openPositionIx,
    whirlpool,
    priceMargin,
    increaseLiquidityIxData,
    positionInitData,
    debugData: {
      name: 'Open Position',
      whirlpool: await formatWhirlpool(whirlpool),
      position: address.toBase58(),
      bundleIndex,
      positionBundle: positionBundle.positionBundleMint.toBase58(),
      priceMargin: priceMargin.toString(),
      priceRange: priceRange.map((val) => toNum(val, 3)),
      tickRange,
    }
  };
}

async function _genPositionInitData({
  whirlpool,
  priceMargin = PRICE_MARGIN_DEFAULT,
  bundleIndex,
  bumpIndex = 0
}: OpenPositionOptions): Promise<PositionInitData> {
  // Use Whirlpool price data to generate position tick range
  const tickRange = await _genPositionTickRange(whirlpool, priceMargin);

  // Get the position bundle associated with configured wallet
  const positionBundle = await getPositionBundle(IGNORE_CACHE);
  if (!positionBundle) throw new Error('Position bundle not available');

  // Get PDA for position bundle (needed b/c positionBundle holds the mint address, not actual bundle address)
  const positionBundlePda = PDAUtil.getPositionBundle(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint
  );

  // Find an unoccupied bundle index for the new position
  const emptyIdxs = PositionBundleUtil.getUnoccupiedBundleIndexes(positionBundle);
  bundleIndex ??= emptyIdxs[bumpIndex % emptyIdxs.length];
  if (bundleIndex == null) throw new Error('No unoccupied bundle index found in position bundle');

  // Get PDA for the new position
  const bundledPositionPda = PDAUtil.getBundledPosition(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint,
    bundleIndex
  );

  const { decimals: decimalsA } = whirlpool.getTokenAInfo();
  const { decimals: decimalsB } = whirlpool.getTokenBInfo();
  const priceRange = toPriceRange(tickRange, [decimalsA, decimalsB]);

  return {
    address: bundledPositionPda.publicKey,
    bundleIndex,
    bundledPositionPda,
    positionBundle,
    positionBundlePda,
    priceMargin,
    priceRange,
    tickRange,
    whirlpool,
  };
}

/**
 * Generates a tick index range for a {@link Whirlpool} position based on a given {@link priceMargin}.
 *
 * `Note`: The generated tick index range will be within `[-443636, 443636]`, which maps to a price range of `[2^-64, 2^64]`.
 * Also, the generated tick index range may not map exactly to the price range due to the {@link Whirlpool} tick spacing.
 *
 * @param whirlpool The {@link Whirlpool} to generate the position range for.
 * @param priceMargin The price margin {@link Percentage} to use for the position.
 * @returns A tuple containing the lower and upper tick index of the position.
 */
async function _genPositionTickRange(
  whirlpool: Whirlpool,
  priceMargin: Percentage,
): Promise<[number, number]> {
  info('Generating position tick range using price margin:', priceMargin.toString());

  // Extract necessary data from Whirlpool
  const { decimals: decimalsA } = whirlpool.getTokenAInfo();
  const { decimals: decimalsB } = whirlpool.getTokenBInfo();
  const { tickSpacing } = whirlpool.getData();
  const price = await getWhirlpoolPrice(whirlpool);

  // Calculate price range based on priceMargin Percentage input
  const priceMarginValue = price.mul(priceMargin.toDecimal());
  const lowerPrice = price.minus(priceMarginValue);
  const upperPrice = price.plus(priceMarginValue);

  // Calculate tick index range based on price range (may not map exactly to price range due to tick spacing)
  return toTickRange([lowerPrice, upperPrice], [decimalsA, decimalsB], tickSpacing); // Subset of [-443636, 443636]
}

/**
 * Generates an {@link Instruction} to open a {@link Position}.
 *
 * @param positionInitData The {@link PositionInitData} for the new position.
 * @returns A {@link Promise} that resolves to the {@link Instruction}.
 */
async function _genOpenPositionIx(positionInitData: PositionInitData): Promise<Instruction> {
  const {
    bundleIndex,
    bundledPositionPda,
    positionBundle,
    positionBundlePda,
    tickRange,
    whirlpool,
  } = positionInitData;

  // Get the position bundle token account (ATA) for the position bundle mint
  const positionBundleTokenAccount = await wallet().getNFTAccount(positionBundle.positionBundleMint);
  if (!positionBundleTokenAccount) throw new Error('Position bundle token account (ATA) cannot be found');

  debug('Ix details for open position:', {
    funder: wallet().publicKey.toBase58(),
    positionBundle: positionBundlePda.publicKey.toBase58(),
    positionBundleTokenAccount: positionBundleTokenAccount.address.toBase58(),
    bundleIndex,
    bundledPosition: bundledPositionPda.publicKey.toBase58(),
    whirlpool: await formatWhirlpool(whirlpool),
    tickLowerIndex: tickRange[0],
    tickUpperIndex: tickRange[1],
  });

  // Create instruction to open position inside bundle
  return WhirlpoolIx.openBundledPositionIx(
    whirlpoolClient().getContext().program,
    {
      funder: wallet().publicKey,
      positionBundle: positionBundlePda.publicKey,
      positionBundleAuthority: wallet().publicKey,
      positionBundleTokenAccount: new PublicKey(positionBundleTokenAccount.address),
      bundleIndex,
      bundledPositionPda,
      whirlpool: whirlpool.getAddress(),
      tickLowerIndex: tickRange[0],
      tickUpperIndex: tickRange[1],
    }
  );
}

async function _genIncreaseLiquidityIxData(
  liquidity: BN | Decimal.Value,
  liquidityUnit: LiquidityUnit | undefined,
  positionInitData: PositionInitData
): Promise<IncreaseLiquidityIxData> {
  const { address, positionBundle, tickRange, whirlpool } = positionInitData;

  return genIncreaseLiquidityIxData({
    liquidity,
    liquidityUnit,
    positionAddress: address,
    positionMint: positionBundle.positionBundleMint,
    tickRange,
    whirlpool,
  });
}

/**
 * Generates a summary of an open {@link Position} transaction.
 *
 * @param args The {@link OpenPositionTxSummaryArgs}.
 * @returns A {@link Promise} that resolves to the {@link OpenPositionTxSummary}.
 */
export async function genOpenPositionTxSummary({
  bundledPosition,
  openPositionIxData,
  sendResult
}: OpenPositionTxSummaryArgs): Promise<OpenPositionTxSummary> {
  const { increaseLiquidityIxData, positionInitData } = openPositionIxData;
  const { priceMargin, priceRange, tickRange } = positionInitData;

  const txSummary = await getTxSummary(sendResult);

  const openPositionTxSummary: OpenPositionTxSummary = {
    bundledPosition,
    priceMargin,
    priceRange,
    tickRange,
    ...txSummary,
  };
  const { position } = bundledPosition;

  const increaseLiquidityQuote = increaseLiquidityIxData?.quote;
  if (increaseLiquidityQuote) {
    const liquidityTxSummary = await genIncreaseLiquidityTxSummary(position, increaseLiquidityIxData, sendResult);
    liquidityTxSummary.fee = 0; // Fee is included in open position tx fee
    openPositionTxSummary.increaseLiquidityTxSummary = liquidityTxSummary;
  }

  return openPositionTxSummary;
}

export type * from './open-position.interfaces.js';
