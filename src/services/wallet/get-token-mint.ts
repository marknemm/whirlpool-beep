import type { TokenQuery } from '@/interfaces/token';
import { getWalletNFTAccount, getWalletNFTAccounts, getWalletTokenAccount } from '@/services/wallet/get-token-account';
import anchor from '@/util/anchor';
import umi from '@/util/umi';
import { type DigitalAsset, fetchAllDigitalAssetByOwner, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';

/**
 * Gets a token mint {@link DigitalAsset} that is associated with the wallet.
 *
 * @param currency The currency {@link TokenQuery} for the {@link DigitalAsset}.
 * @returns A {@link Promise} that resolves to the {@link DigitalAsset}.
 */
export async function getWalletTokenMintAsset(currency: TokenQuery): Promise<DigitalAsset | null> {
  const tokenAccount = await getWalletTokenAccount(currency);

  return tokenAccount
    ? await fetchDigitalAsset(umi(), publicKey(tokenAccount.address))
    : null;
}

/**
 * Gets all token mint {@link DigitalAsset}s associated with the wallet.
 *
 * @returns A {@link Promise} that resolves to an array of {@link DigitalAsset}s.
 */
export async function getWalletTokenMintAssets(): Promise<DigitalAsset[]> {
  return await fetchAllDigitalAssetByOwner(
    umi(),
    publicKey(anchor().wallet.publicKey)
  );
}

/**
 * Gets an NFT mint {@link DigitalAsset} associated with the wallet.
 *
 * @param query The {@link TokenQuery} for the NFT {@link DigitalAsset}.
 * @returns A {@link Promise} that resolves to the NFT {@link DigitalAsset}.
 */
export async function getWalletNFTMintAsset(query: TokenQuery): Promise<DigitalAsset | null> {
  const nftAccount = await getWalletNFTAccount(query);

  return nftAccount
    ? await fetchDigitalAsset(umi(), publicKey(nftAccount.address))
    : null;
}

/**
 * Gets all NFT mint {@link DigitalAsset}s associated with the wallet.
 *
 * @returns A {@link Promise} that resolves to an array of NFT {@link DigitalAsset}s.
 */
export async function getWalletNFTMintAssets() {
  const nftAccounts = await getWalletNFTAccounts();
  const digitalAssets = [];

  for (const nftAccount of nftAccounts) {
    digitalAssets.push(await fetchDigitalAsset(umi(), publicKey(nftAccount.mint)));
  }

  return digitalAssets;
}
