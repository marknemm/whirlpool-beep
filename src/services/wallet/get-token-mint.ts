import type { TokenQuery } from '@/interfaces/token';
import { getToken } from '@/services/token/get-token';
import { getWalletNFTAccount, getWalletNFTAccounts, getWalletTokenAccount, getWalletTokenAccounts } from '@/services/wallet/get-token-account';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';

/**
 * Gets a token mint {@link DigitalAsset} that is associated with the wallet.
 *
 * @param currency The currency {@link TokenQuery} for the {@link DigitalAsset}.
 * @returns A {@link Promise} that resolves to the {@link DigitalAsset}.
 */
export async function getWalletTokenMintAsset(currency: TokenQuery): Promise<DigitalAsset | null> {
  const tokenAccount = await getWalletTokenAccount(currency);

  return tokenAccount
    ? await getToken(tokenAccount.mint)
    : null;
}

/**
 * Gets all token mint {@link DigitalAsset}s associated with the wallet.
 *
 * @returns A {@link Promise} that resolves to an array of {@link DigitalAsset}s.
 */
export async function getWalletTokenMintAssets(): Promise<DigitalAsset[]> {
  const tokenAccounts = await getWalletTokenAccounts();
  const digitalAssets = [];

  for (const nftAccount of tokenAccounts) {
    const digitalAsset = await getToken(nftAccount.mint);
    if (digitalAsset) {
      digitalAssets.push(digitalAsset);
    }
  }

  return digitalAssets;
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
    ? await getToken(nftAccount.mint)
    : null;
}

/**
 * Gets all NFT mint {@link DigitalAsset}s associated with the wallet.
 *
 * @returns A {@link Promise} that resolves to an array of NFT {@link DigitalAsset}s.
 */
export async function getWalletNFTMintAssets(): Promise<DigitalAsset[]> {
  const nftAccounts = await getWalletNFTAccounts();
  const digitalAssets = [];

  for (const nftAccount of nftAccounts) {
    const digitalAsset = await getToken(nftAccount.mint);
    if (digitalAsset) {
      digitalAssets.push(digitalAsset);
    }
  }

  return digitalAssets;
}
