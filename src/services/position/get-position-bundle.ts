import { type PositionBundleData } from '@orca-so/whirlpools-sdk';
import { getWalletNFTMintAssets } from '@/services/wallet/get-token-mint';

/**
 * Get a {@link Whirlpool} {@link PositionBundleData}.
 *
 * @returns A {@link Promise} that resolves to the {@link PositionBundleData} in the {@link Whirlpool}.
 */
export async function getPositionBundle(): Promise<PositionBundleData | null> {
  getWalletNFTMintAssets();

  return null;
}
