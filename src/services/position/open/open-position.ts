import PositionDAO from '@/data/position/position.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { getPositionBundle } from '@/services/position-bundle/query/query-position-bundle';
import { expBackoff } from '@/util/async/async';
import { debug, error, info } from '@/util/log/log';
import { getProgramErrorInfo } from '@/util/program/program';
import rpc from '@/util/rpc/rpc';
import { toPriceRange, toTickRange } from '@/util/tick-range/tick-range';
import { executeTransaction, getTransactionSummary } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolPrice } from '@/util/whirlpool/whirlpool';
import { Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type { GenOpenPositionTxReturn, OpenPositionOptions, OpenPositionTxSummary } from './open-position.interfaces';

/**
 * Opens a {@link Position} in a {@link Whirlpool}.
 *
 * @param options The {@link OpenPositionOptions}.
 * @returns A {@link Promise} that resolves to the newly opened {@link Position}.
 */
export async function openPosition(options: OpenPositionOptions): Promise<OpenPositionTxSummary> {
  const {
    whirlpool,
    priceMargin = Percentage.fromFraction(3, 100)
  } = options;

  const opMetadata = {
    whirlpool: whirlpool.getAddress().toBase58(),
    priceMargin: priceMargin.toString(),
  };

  try {
    return expBackoff(async () => {
      info('\n-- Open Position --\n', opMetadata);

      const { address, bundleIndex, positionBundle, priceRange, tickRange, tx } = await genOpenPositionTx(options);

      // Execute and verify the transaction
      const signature = await executeTransaction(tx, {
        name: 'Open Position',
        whirlpool: await formatWhirlpool(whirlpool),
        position: address.toBase58(),
        bundleIndex,
        positionBundle: positionBundle.positionBundleMint.toBase58(),
        priceMargin: priceMargin.toString(),
        priceRange,
        tickRange,
      });

      // Get, store, and return the open position transaction summary
      const position = await expBackoff(() => whirlpoolClient().getPosition(address, IGNORE_CACHE));
      const bundledPosition: BundledPosition = { bundleIndex, position, positionBundle };
      const txSummary = await genOpenPositionTxSummary(bundledPosition, signature);
      await PositionDAO.insert(txSummary, { catchErrors: true });
      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return errInfo?.code === 0x0; // Retry if error is due to new position address clash.
      }
    });
  } catch (err) {
    error('Failed to open position:', opMetadata);
    throw err;
  }
}

/**
 * Creates a transaction to open a {@link Position} in a {@link Whirlpool}.
 *
 * @param options The {@link OpenPositionOptions}.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genOpenPositionTx({
  bumpIndex = 0,
  bundleIndex,
  priceMargin = Percentage.fromFraction(3, 100),
  whirlpool
}: OpenPositionOptions): Promise<GenOpenPositionTxReturn> {
  info('Creating Tx to open position:', {
    whirlpool: await formatWhirlpool(whirlpool),
    priceMargin: priceMargin.toString(),
  });

  // Use Whirlpool price data to generate position tick range
  const tickRange = await _genPositionTickRange(whirlpool, priceMargin);

  // Get the position bundle associated with configured wallet
  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  // Get PDA for position bundle (needed b/c positionBundle holds the mint address, not actual bundle address)
  const positionBundlePda = PDAUtil.getPositionBundle(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint
  );

  // Get the position bundle token account (ATA) for the position bundle mint
  const positionBundleTokenAccount = await wallet().getNFTAccount(positionBundle.positionBundleMint);
  if (!positionBundleTokenAccount) throw new Error('Position bundle token account (ATA) cannot be found');

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

  debug('Tx details for open position:', {
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
  const openPositionIx = await WhirlpoolIx.openBundledPositionIx(
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

  // Create a transaction to open position inside bundle
  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(openPositionIx);

  const { decimals: decimalsA } = whirlpool.getTokenAInfo();
  const { decimals: decimalsB } = whirlpool.getTokenBInfo();
  const priceRange = toPriceRange(tickRange, [decimalsA, decimalsB]);

  info('Created tx to open position:', {
    whirlpool: await formatWhirlpool(whirlpool),
    position: bundledPositionPda.publicKey.toBase58(),
    bundleIndex,
    positionBundle: positionBundle.positionBundleMint.toBase58(),
    priceRange: priceRange.map((price) => price.toFixed(decimalsB)),
    tickRange,
  });

  return {
    address: bundledPositionPda.publicKey,
    bundleIndex,
    positionBundle,
    priceRange,
    tickRange,
    tx
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
 * Generates a summary of an open {@link Position} transaction.
 *
 * @param bundledPosition The {@link BundledPosition} that was opened.
 * @param signature The signature of the open {@link Position} transaction.
 * @returns A {@link Promise} that resolves to the {@link OpenPositionTxSummary}.
 */
export async function genOpenPositionTxSummary(
  bundledPosition: BundledPosition,
  signature: string
): Promise<OpenPositionTxSummary> {
  const txSummary = await getTransactionSummary(signature);

  return {
    bundledPosition,
    signature,
    fee: txSummary.fee,
  };
}

export type * from './open-position.interfaces';
