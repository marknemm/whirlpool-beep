import type { TokenQuery } from '@/interfaces/token';
import { getToken } from '@/services/token/get-token';
import anchor from '@/util/anchor';
import { toNum } from '@/util/currency';
import rpc from '@/util/rpc';
import { type Wallet } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, unpackAccount, type Account } from '@solana/spl-token';
import { PublicKey, type ParsedAccountData, type TokenAccountsFilter } from '@solana/web3.js';

/**
 * Gets an SPL token {@link Account} (`ATA`) associated with the {@link Wallet}.
 *
 * @param currency The currency {@link TokenQuery} for the SPL token {@link Account}.
 * @returns A {@link Promise} that resolves to the SPL token {@link Account}.
 */
export async function getWalletTokenAccount(currency: TokenQuery): Promise<Account | null> {
  const currencyToken = await getToken(currency);
  if (!currencyToken) {
    throw new Error(`Failed to fetch token metadata for query: ${currency}`);
  }

  const tokenAccounts = await getWalletTokenAccounts({
    mint: new PublicKey(currencyToken.mint.publicKey),
  });

  return tokenAccounts?.length
    ? tokenAccounts[0]
    : null;
}

/**
 * Gets all SPL token {@link Account}s (`ATA`) associated with the {@link Wallet}.
 *
 * @param filter The optional {@link TokenAccountsFilter} to apply to the token accounts.
 * Defaults to `{ programId: TOKEN_PROGRAM_ID }`.
 * @returns A {@link Promise} that resolves to an array of SPL token {@link Account}s.
 */
export async function getWalletTokenAccounts(filter?: TokenAccountsFilter): Promise<Account[]> {
  const accountsResponse = await rpc().getTokenAccountsByOwner(
    anchor().wallet.publicKey,
    {
      programId: TOKEN_PROGRAM_ID,
      ...filter
    }
  );

  return accountsResponse.value.map((responseData) =>
    unpackAccount(responseData.pubkey, responseData.account)
  );
}

/**
 * Gets an NFT {@link Account} (`ATA`) associated with the wallet.
 *
 * @param query The {@link TokenQuery} for the NFT {@link Account}.
 * @returns A {@link Promise} that resolves to the NFT {@link Account}.
 */
export async function getWalletNFTAccount(query: TokenQuery): Promise<Account | null> {
  const currencyToken = await getToken(query);
  if (!currencyToken) {
    throw new Error(`Failed to fetch token metadata for query: ${query}`);
  }

  const nftAccounts = await getWalletNFTAccounts({
    mint: new PublicKey(currencyToken.mint.publicKey),
  });

  return nftAccounts?.length
    ? nftAccounts[0]
    : null;
}

/**
 * Gets all NFT {@link Account}s (`ATA`) associated with the wallet.
 *
 * @param filter The optional {@link TokenAccountsFilter} to apply to the token accounts.
 * @returns A {@link Promise} that resolves to an array of NFT {@link Account}s.
 */
export async function getWalletNFTAccounts(filter?: TokenAccountsFilter): Promise<Account[]> {
  const tokenAccounts = await getWalletTokenAccounts(filter);
  const nftAccounts = [];

  // NFTs have both an amount of 1 in ATA and supply of 1 in the token mint account.
  for (const tokenAccount of tokenAccounts) {
    if (tokenAccount.amount === 1n) {
      const tokenMintResponse = await rpc().getParsedAccountInfo(tokenAccount.mint);
      const parsedAccount = (tokenMintResponse.value?.data as ParsedAccountData).parsed;
      if (toNum(parsedAccount?.info?.supply) === 1) {
        nftAccounts.push(tokenAccount);
      }
    }
  }

  return nftAccounts;
}
