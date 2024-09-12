import { type Address } from '@coral-xyz/anchor';
import { debug, expBackoff, type Null } from '@npc/core';
import { WHIRLPOOL_POSITION_BUNDLE_SYMBOL } from '@npc/orca/constants/whirlpool';
import whirlpoolClient, { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { TransactionContext, wallet } from '@npc/solana';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, WhirlpoolIx, type Position, type PositionBundleData, type WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Keypair, PublicKey } from '@solana/web3.js';
import type { BundledPosition, GetPositionsOptions } from './position.interfaces';

/**
 * Creates a position bundle.
 *
 * A position bundle encompasses ownership of multiple positions using only a single NFT.
 * This renders management of multiple positions more cost-effective since rent cannot be refunded for NFTs.
 *
 * The position bundle is created with the following linked accounts:
 * - Mint: The mint account for the position bundle.
 * - Position Bundle: The position bundle account.
 * - Metadata: The metadata account for the position bundle.
 * - Token Account: The associated token account (`ATA`) for the position bundle.
 *
 * @returns A {@link Promise} that resolves to the {@link PublicKey} (address) of the position bundle.
 * @throws An {@link Error} if the position bundle initialization fails to complete.
 */
export async function createPositionBundle(): Promise<PositionBundleData> {
  debug('\n-- Create Position Bundle --');

  // Generate keypair and PDAs for position bundle
  const positionBundleMintKeypair = Keypair.generate();
  const positionBundlePda = PDAUtil.getPositionBundle(ORCA_WHIRLPOOL_PROGRAM_ID, positionBundleMintKeypair.publicKey);
  const positionBundleMetadataPda = PDAUtil.getPositionBundleMetadata(positionBundleMintKeypair.publicKey);
  const positionBundleTokenAccount = await getAssociatedTokenAddress(
    positionBundleMintKeypair.publicKey,
    wallet().publicKey
  );

  const initPositionBundleIx = WhirlpoolIx.initializePositionBundleWithMetadataIx(
    whirlpoolClient().getContext().program,
    {
      funder: wallet().publicKey,
      owner: wallet().publicKey,
      positionBundleMintKeypair,
      positionBundlePda,
      positionBundleMetadataPda,
      positionBundleTokenAccount,
    }
  );

  // Send transaction to create position bundle
  await new TransactionContext()
    .addInstructionSet(initPositionBundleIx)
    .send({
      debugData: {
        name: 'Create Position Bundle',
        positionBundleMetadata: positionBundleMetadataPda.publicKey,
        positionBundleMintAddress: positionBundleMintKeypair.publicKey,
        positionBundle: positionBundlePda.publicKey,
        positionBundleTokenAccount,
      }
    });

  // Get and return position bundle data
  const positionBundle = await expBackoff(() =>
    whirlpoolClient().getFetcher().getPositionBundle(positionBundlePda.publicKey)
  );
  if (!positionBundle) throw new Error('Could not retrieve position bundle data after initialization');
  return positionBundle;
}

/**
 * Formats a {@link Position} or {@link BundledPosition} into a log string.
 *
 * @param position The {@link Position} or {@link BundledPosition} to format.
 * @param includeWhirlpool Whether to include the whirlpool data in the log string.
 * @returns A {@link Promise} that resolves to the formatted log string.
 */
export async function formatPosition(
  position: Address | BundledPosition | Position | Null,
  includeWhirlpool = false
): Promise<string> {
  if (!position) return '';
  position = await resolvePosition(position);

  const whirlpoolData = position.getWhirlpoolData();

  return includeWhirlpool
    ? `${position.getAddress().toBase58()} ---- ${await formatWhirlpool(whirlpoolData)}`
    : position.getAddress().toBase58();
}

/**
 * Gets a {@link BundledPosition}.
 *
 * @param positionAddress The {@link Address} of the {@link Position} to get.
 * @param opts The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link BundledPosition}.
 */
export async function getPosition(
  positionAddress: Address,
  opts?: WhirlpoolAccountFetchOptions
): Promise<BundledPosition> {
  debug('Getting bundled position:', positionAddress);

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const occupiedIdxs = PositionBundleUtil.getOccupiedBundleIndexes(positionBundle);
  for (const idx of occupiedIdxs) {
    const positionPda = PDAUtil.getBundledPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionBundle.positionBundleMint,
      idx
    );

    if (positionPda.publicKey.equals(new PublicKey(positionAddress))) {
      const position = await whirlpoolClient().getPosition(positionAddress, opts);
      if (!position) throw new Error('Position not found');

      return {
        bundleIndex: idx,
        position,
        positionBundle
      };
    }
  }

  throw new Error('Position not found');
}

/**
 * Gets a {@link BundledPosition} at a specific `PositionBundle` index.
 *
 * @param bundleIndex The index of the {@link Position} in the `PositionBundle`.
 * @param opts The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link BundledPosition}.
 */
export async function getPositionAtIdx(
  bundleIndex: number,
  opts?: WhirlpoolAccountFetchOptions
): Promise<BundledPosition> {
  debug('Getting bundled position at index:', bundleIndex);

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const positionPda = PDAUtil.getBundledPosition(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint,
    bundleIndex
  );

  const position = await whirlpoolClient().getPosition(positionPda.publicKey, opts);
  if (!position) throw new Error('Position not found');

  return {
    bundleIndex,
    position,
    positionBundle
  };
}

/**
 * Get a {@link PositionBundleData}.
 *
 * If a {@link PositionBundleData} does not exist, a new one will be created and returned via {@link createPositionBundle}.
 *
 * A position bundle encompasses ownership of multiple positions using only a single NFT.
 * This renders management of multiple positions more cost-effective since rent cannot be refunded for NFTs.
 *
 * @param options The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link PositionBundleData}.
 * @returns A {@link Promise} that resolves to the {@link PositionBundleData}.
 * @throws An {@link Error} if the position bundle cannot be found or created.
 */
export async function getPositionBundle(options?: WhirlpoolAccountFetchOptions): Promise<PositionBundleData> {
  const nfts = await wallet().getNFTMintAssets();
  const bundleNFT = nfts.find((nft) => nft.metadata.symbol === WHIRLPOOL_POSITION_BUNDLE_SYMBOL);

  const bundlePDA = bundleNFT
    ? PDAUtil.getPositionBundle(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      new PublicKey(bundleNFT.mint.publicKey)
    )
    : null;

  const positionBundle = bundlePDA
    ? await whirlpoolClient().getFetcher().getPositionBundle(bundlePDA.publicKey, options)
    : await createPositionBundle(); // Create and return new position bundle if one does not exist

  if (!positionBundle) throw new Error('Could not find or create position bundle');
  return positionBundle;
}

/**
 * Get all {@link BundledPosition}s in the `PositionBundle` associated with the {@link Wallet}.
 *
 * @param opts The {@link GetPositionsOptions} to use when fetching the {@link Position}s.
 * @returns A {@link Promise} that resolves to an array of {@link BundledPosition}s.
 */
export async function getPositions({
  whirlpoolAddress,
  ...whirlpoolAccountFetchOptions
}: GetPositionsOptions): Promise<BundledPosition[]> {
  whirlpoolAddress
    ? debug('Getting all bundled positions in whirlpool:', whirlpoolAddress)
    : debug('Getting all bundled positions...');

  const positions: BundledPosition[] = [];

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const occupiedIdxs = PositionBundleUtil.getOccupiedBundleIndexes(positionBundle);
  for (const idx of occupiedIdxs) {
    const positionPda = PDAUtil.getBundledPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionBundle.positionBundleMint,
      idx
    );

    const position = await whirlpoolClient().getPosition(positionPda.publicKey, whirlpoolAccountFetchOptions);
    if (position && (!whirlpoolAddress || new PublicKey(whirlpoolAddress).equals(position.getData().whirlpool))) {
      positions.push({
        bundleIndex: idx,
        position,
        positionBundle
      });
    }
  }

  return positions;
}

/**
 * Resolves a {@link Position} from an {@link Address} or {@link Position}.
 *
 * @param position The {@link Address} or {@link Position} to resolve.
 * @param opts The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link Position}.
 */
export async function resolvePosition(
  position: Address | BundledPosition | Position,
  opts?: WhirlpoolAccountFetchOptions
): Promise<Position> {
  if (position instanceof Object && 'position' in position) {
    return (position as BundledPosition).position;
  }

  if (position instanceof Object && 'getWhirlpoolData' in position) {
    return position as Position;
  }

  return getPosition(position as Address, opts).then(
    (bundledPosition) => bundledPosition.position
  );
}

export type * from './position.interfaces';
