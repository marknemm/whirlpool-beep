import type { BundledPosition, GenOptionPositionTxReturn } from '@/interfaces/position';
import { getPositionBundle } from '@/services/position-bundle/get-position-bundle';
import { toPrice } from '@/util/currency';
import { debug, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import wallet from '@/util/wallet';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool';
import { TransactionBuilder, type Percentage } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, PriceMath, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Opens a {@link Position} in a {@link Whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} to open a {@link Position} in.
 * @param priceMargin The price margin {@link Percentage} to use for the {@link Position}.
 * @returns A {@link Promise} that resolves to the newly opened {@link Position}.
 */
export async function openPosition(whirlpool: Whirlpool, priceMargin: Percentage): Promise<BundledPosition> {
  info('\n-- Open Position --');

  const { address, bundleIndex, positionBundle, tx } = await genOpenPositionTx(whirlpool, priceMargin);

  // Execute and verify the transaction
  info('Executing open position transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);
  info('Whirlpool position opened with address:', address.toBase58());

  // Get and return the newly opened position
  const position = await whirlpoolClient().getPosition(address);
  debug('Position opened:', position);
  return { bundleIndex, position, positionBundle };
}

/**
 * Creates a transaction to open a {@link Position} in a {@link Whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} to open a {@link Position} in.
 * @param priceMargin The price margin {@link Percentage} to use for the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genOpenPositionTx(
  whirlpool: Whirlpool,
  priceMargin: Percentage
): Promise<GenOptionPositionTxReturn> {
  info('Creating Tx to open position in whirlpool:', formatWhirlpool(whirlpool));

  // Use Whirlpool price data to generate position tick range
  const tickRange = _genPositionTickRange(whirlpool, priceMargin);

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
  const bundleIndex = PositionBundleUtil.findUnoccupiedBundleIndex(positionBundle);
  if (bundleIndex == null) throw new Error('No unoccupied bundle index found in position bundle');

  // Get PDA for the new position
  const bundledPositionPda = PDAUtil.getBundledPosition(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint,
    bundleIndex
  );

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

  return { address: bundledPositionPda.publicKey, bundleIndex, positionBundle, tx };
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
function _genPositionTickRange(
  whirlpool: Whirlpool,
  priceMargin: Percentage,
): [number, number] {
  info('Generating position tick range using price margin:', priceMargin.toString());

  // Extract necessary data from Whirlpool
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();
  const { tickSpacing } = whirlpool.getData();
  const price = toPrice(whirlpool);

  // Calculate price range based on priceMargin Percentage input
  const priceMarginValue = price.mul(priceMargin.toDecimal());
  const lowerPrice = price.minus(priceMarginValue);
  const upperPrice = price.plus(priceMarginValue);

  // Calculate tick index range based on price range (tick index range may not map exactly to price range due to tick spacing)
  const lowerTick = PriceMath.priceToInitializableTickIndex(lowerPrice, tokenA.decimals, tokenB.decimals, tickSpacing);
  const upperTick = PriceMath.priceToInitializableTickIndex(upperPrice, tokenA.decimals, tokenB.decimals, tickSpacing);

  _logPositionRange([lowerTick, upperTick], whirlpool);
  return [lowerTick, upperTick]; // Subset of range [-443636, 443636]
}

/**
 * Log the price range data for a {@link Whirlpool} position.
 *
 * @param tickRange The tick range data to log.
 * @param whirlpool The {@link Whirlpool} to log the position range for.
 */
function _logPositionRange(tickRange: [number, number], whirlpool: Whirlpool) {
  if (!tickRange || !whirlpool) return;

  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  const priceRange = [
    PriceMath.tickIndexToPrice(tickRange[0], tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
    PriceMath.tickIndexToPrice(tickRange[1], tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
  ];

  info(`Lower & upper tick index: [${tickRange[0]}, ${tickRange[1]}]`);
  info(`Lower & upper price: [${priceRange[0]}, ${priceRange[1]}]`);
}
