import { WHIRLPOOL_POSITION_BUNDLE_SYMBOL } from '@/constants/whirlpool';
import { createPositionBundle } from '@/services/position-bundle/create-position-bundle';
import wallet from '@/util/wallet';
import whirlpoolClient from '@/util/whirlpool';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type PositionBundleData } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Get a {@link PositionBundleData}.
 *
 * If a {@link PositionBundleData} does not exist, a new one will be created and returned via {@link createPositionBundle}.
 *
 * A position bundle encompasses ownership of multiple positions using only a single NFT.
 * This renders management of multiple positions more cost-effective since rent cannot be refunded for NFTs.
 *
 * @returns A {@link Promise} that resolves to the {@link PositionBundleData}.
 * @throws An {@link Error} if the position bundle cannot be found or created.
 */
export async function getPositionBundle(): Promise<PositionBundleData> {
  const nfts = await wallet().getNFTMintAssets();
  const bundleNFT = nfts.find((nft) => nft.metadata.symbol === WHIRLPOOL_POSITION_BUNDLE_SYMBOL);

  const bundlePDA = bundleNFT
    ? PDAUtil.getPositionBundle(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      new PublicKey(bundleNFT.mint.publicKey)
    )
    : null;

  const positionBundle = bundlePDA
    ? await whirlpoolClient().getFetcher().getPositionBundle(bundlePDA.publicKey)
    : await createPositionBundle(); // Create and return new position bundle if one does not exist

  if (!positionBundle) throw new Error('Could not find or create position bundle');
  return positionBundle;
}
