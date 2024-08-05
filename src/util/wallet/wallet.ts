import env from '@/util/env/env';
import { info } from '@/util/log/log';
import { toBN, toSol } from '@/util/number-conversion/number-conversion';
import { decodeBase58 } from '@/util/pki/pki';
import rpc from '@/util/rpc/rpc';
import { getNFT, getToken, type TokenQuery } from '@/util/token/token';
import { BN, Wallet } from '@coral-xyz/anchor';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { TOKEN_PROGRAM_ID, unpackAccount, type Account } from '@solana/spl-token';
import { Keypair, PublicKey, type TokenAccountsFilter } from '@solana/web3.js';

/**
 * Extends the Anchor {@link Wallet} class with additional functionality.
 *
 * @augments Wallet
 */
export class WalletExt extends Wallet {

  /**
   * Initializes a new {@link WalletExt} instance.
   *
   * @param address The wallet address. Defaults to the environment variable {@link env.WALLET_ADDRESS}.
   * @param privateKey The wallet private key. Defaults to the environment variable {@link env.WALLET_PRIVATE_KEY}.
   */
  constructor(
    address: string = env.WALLET_ADDRESS,
    privateKey: string = env.WALLET_PRIVATE_KEY,
  ) {
    // Generate a keypair from private key raw bytes
    const privateKeyBytes = decodeBase58(privateKey);
    const keypair = Keypair.fromSecretKey(privateKeyBytes); // Performs implicit mathematical validation

    // Double check that the keypair public key matches the expected wallet address
    if (keypair.publicKey.toBase58() !== address) {
      throw new Error('Public key does not match expected value');
    }

    super(keypair);
  }

  /**
   * Queries the wallet account balance.
   *
   * @param currency The currency to query the balance for. Defaults to `SOL`.
   * Can be a token symbol or mint {@link Address}.
   * @returns A {@link Promise} that resolves to the wallet account balance.
   */
  async getBalance(currency: TokenQuery = 'SOL'): Promise<BN> {
    const currencyToken = await getToken(currency);
    if (!currencyToken) {
      throw new Error(`Failed to fetch token metadata for query: ${currency}`);
    }

    let amount = new BN(0);

    if (currencyToken.metadata.symbol === 'SOL') {
      // Fetch the default wallet balance and convert Lamports to SOL
      const lamports = await rpc().getBalance(wallet().publicKey);
      amount = toBN(toSol(lamports), currencyToken.mint.decimals);
    } else {
      // Fetch the desired token account and get amount
      const tokenAccount = await this.getTokenAccount(currencyToken.mint.publicKey);
      amount = toBN(tokenAccount?.amount, currencyToken.mint.decimals);
    }

    return amount;
  }

  /**
   * Gets an NFT {@link Account} (`ATA`) associated with the wallet.
   *
   * @param query The {@link TokenQuery} for the NFT {@link Account}.
   * @returns A {@link Promise} that resolves to the NFT {@link Account}.
   */
  async getNFTAccount(query: TokenQuery): Promise<Account | null> {
    const currencyToken = await getToken(query);
    if (!currencyToken) {
      throw new Error(`Failed to fetch token metadata for query: ${query}`);
    }

    const nftAccounts = await this.getNFTAccounts({
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
  async getNFTAccounts(filter?: TokenAccountsFilter): Promise<Account[]> {
    const tokenAccounts = await this.getTokenAccounts(filter);
    const nftAccounts = [];

    // NFTs have both an amount of 1 in ATA and supply of 1 in the token mint account.
    for (const tokenAccount of tokenAccounts) {
      if (tokenAccount.amount === 1n) {
        const nft = await getNFT(tokenAccount.mint);
        if (nft) {
          nftAccounts.push(tokenAccount);
        }
      }
    }

    return nftAccounts;
  }

  /**
   * Gets an SPL token {@link Account} (`ATA`) associated with the {@link Wallet}.
   *
   * @param currency The currency {@link TokenQuery} for the SPL token {@link Account}.
   * @returns A {@link Promise} that resolves to the SPL token {@link Account}.
   */
  async getTokenAccount(currency: TokenQuery): Promise<Account | null> {
    const currencyToken = await getToken(currency);
    if (!currencyToken) {
      throw new Error(`Failed to fetch token metadata for query: ${currency}`);
    }

    const tokenAccounts = await this.getTokenAccounts({
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
  async getTokenAccounts(filter?: TokenAccountsFilter): Promise<Account[]> {
    const accountsResponse = await rpc().getTokenAccountsByOwner(
      wallet().publicKey,
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
   * Gets all NFT mint {@link DigitalAsset}s associated with the wallet.
   *
   * @returns A {@link Promise} that resolves to an array of NFT {@link DigitalAsset}s.
   */
  async getNFTMintAssets(): Promise<DigitalAsset[]> {
    const nftAccounts = await this.getNFTAccounts();
    const digitalAssets = [];

    for (const nftAccount of nftAccounts) {
      const digitalAsset = await getToken(nftAccount.mint);
      if (digitalAsset) {
        digitalAssets.push(digitalAsset);
      }
    }

    return digitalAssets;
  }

  /**
   * Gets all token mint {@link DigitalAsset}s associated with the wallet.
   *
   * @returns A {@link Promise} that resolves to an array of {@link DigitalAsset}s.
   */
  async getTokenMintAssets(): Promise<DigitalAsset[]> {
    const tokenAccounts = await this.getTokenAccounts();
    const digitalAssets = [];

    for (const nftAccount of tokenAccounts) {
      const digitalAsset = await getToken(nftAccount.mint);
      if (digitalAsset) {
        digitalAssets.push(digitalAsset);
      }
    }

    return digitalAssets;
  }

}

let _wallet: WalletExt;

/**
 * Gets the singleton {@link WalletExt}, and initializes it if it has not already been initialized.
 *
 * Initializes the wallet with the environment variables {@link env.WALLET_ADDRESS} and {@link env.WALLET_PRIVATE_KEY}.
 *
 * @returns The {@link WalletExt} singleton.
 * @throws An {@link Error} if the {@link WalletExt} private key is invalid or does not match the expected public key.
 */
export default function wallet(): WalletExt {
  if (!_wallet) {
    _wallet = new WalletExt();

    info('-- Initialized Wallet --');
    info('Wallet Address:', _wallet.publicKey.toBase58());
  }

  return _wallet;
}
