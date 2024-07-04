import { WHIRLPOOL_POSITION_BUNDLE_SYMBOL } from '@/constants/whirlpool';
import { createPositionBundle } from '@/services/position/create-position-bundle';
import { getWalletNFTMintAssets } from '@/services/wallet/get-token-mint';
import whirlpoolClient from '@/util/whirlpool-client';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type PositionBundleData } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Get a {@link PositionBundleData} for managing multiple {@link Whirlpool}s while minimizing cost.
 * If a {@link PositionBundleData} does not exist, a new one will be created and returned.
 *
 * @returns A {@link Promise} that resolves to the {@link PositionBundleData}.
 */
export async function getPositionBundle(): Promise<PositionBundleData | null> {
  const nfts = await getWalletNFTMintAssets();
  const bundleNFT = nfts.find((nft) => nft.metadata.symbol === WHIRLPOOL_POSITION_BUNDLE_SYMBOL);

  const bundlePDA = bundleNFT
    ? PDAUtil.getPositionBundle(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      new PublicKey(bundleNFT.mint.publicKey)
    )
    : null;

  return bundlePDA
    ? whirlpoolClient().getFetcher().getPositionBundle(bundlePDA.publicKey)
    : createPositionBundle(); // Create and return new position bundle if one does not exist
}
