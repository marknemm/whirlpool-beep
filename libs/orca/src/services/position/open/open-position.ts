import { debug, error, expBackoff, genPriceMarginRange, info } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import { genIncreaseLiquidityIxSet } from '@npc/orca/services/liquidity/increase/increase-liquidity';
import { getPositionBundle } from '@npc/orca/util/position/position';
import { toPriceRange, toTickRange } from '@npc/orca/util/tick-range/tick-range';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolPrice, resolveWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, TransactionContext, wallet } from '@npc/solana';
import { Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type { OpenPositionArgs, OpenPositionIxSet, OpenPositionTxCtx, OpenPositionTxSummary } from './open-position.interfaces';

const PRICE_MARGIN_DEFAULT = Percentage.fromFraction(3, 100); // 3%

/**
 * Opens a {@link Position} in a {@link Whirlpool}.
 *
 * @param args The {@link OpenPositionArgs}.
 * @returns A {@link Promise} that resolves to the newly opened {@link Position}.
 */
export async function openPosition(args: OpenPositionArgs): Promise<OpenPositionTxSummary> {
  const { priceMargin = PRICE_MARGIN_DEFAULT } = args;
  const whirlpool = await resolveWhirlpool(args.whirlpool);

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

      const txCtx = await genOpenPositionTxCtx(args);

      // Prepare and send transaction to open position
      const txSummary = await txCtx.send();

      // Get, store, and return the open position transaction summary
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
 * Generates an {@link OpenPositionTxCtx} for opening a {@link Position} in a {@link Whirlpool}.
 *
 * @param args The {@link OpenPositionArgs}.
 * @returns A {@link Promise} that resolves to the {@link OpenPositionTxCtx}.
 */
export async function genOpenPositionTxCtx(args: OpenPositionArgs): Promise<OpenPositionTxCtx> {
  const transactionCtx: OpenPositionTxCtx = new TransactionContext();

  const openPositionIxSet = await genOpenPositionIxSet(args);
  transactionCtx.setInstructionSet('openPosition', openPositionIxSet);

  if (args.liquidity) {
    const increaseLiquidityIxSet = await genIncreaseLiquidityIxSet(args.liquidity);
    transactionCtx.setInstructionSet('increaseLiquidity', increaseLiquidityIxSet);
  }

  return transactionCtx;
}

/**
 * Generates an {@link OpenPositionIxSet} for opening a {@link Position} in a {@link Whirlpool}.
 *
 * @param args The {@link OpenPositionArgs}.
 * @returns A {@link Promise} that resolves to the {@link OpenPositionIxSet}.
 */
export async function genOpenPositionIxSet(args: OpenPositionArgs): Promise<OpenPositionIxSet> {
  const {
    bumpIndex = 0,
    priceMargin = PRICE_MARGIN_DEFAULT,
  } = args;
  const whirlpool = await resolveWhirlpool(args.whirlpool);

  info('Creating instructions to open position:', {
    whirlpool: await formatWhirlpool(whirlpool),
    priceMargin: priceMargin.toString(),
  });

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
  const bundleIndex = emptyIdxs[bumpIndex % emptyIdxs.length];
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
  const openPositionIx = WhirlpoolIx.openBundledPositionIx(
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

  info('Created instruction to open position:', {
    whirlpool: await formatWhirlpool(whirlpool),
    position: bundledPositionPda.publicKey,
    priceRange,
    tickRange,
  });

  return {
    metadata: {
      bundleIndex,
      position: bundledPositionPda.publicKey,
      positionBundle: positionBundlePda.publicKey,
      priceMargin,
      priceRange,
      tickRange,
      whirlpool: whirlpool.getAddress(),
    },
    ...openPositionIx,
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
  const [lowerPrice, upperPrice] = genPriceMarginRange(price, priceMargin.toDecimal());

  // Calculate tick index range based on price range (may not map exactly to price range due to tick spacing)
  return toTickRange([lowerPrice, upperPrice], [decimalsA, decimalsB], tickSpacing); // Subset of [-443636, 443636]
}

export type * from './open-position.interfaces';
