import type { TokenQuery } from '@/interfaces/token';
import { getTokenMeta } from '@/services/token/get-token';
import anchor from '@/util/anchor';
import { toSol } from '@/util/currency';
import { debug } from '@/util/log';
import rpc from '@/util/rpc';
import { BN } from '@coral-xyz/anchor';
import { DecimalUtil, type Address } from '@orca-so/common-sdk';
import { TOKEN_PROGRAM_ID, unpackAccount, type Account } from '@solana/spl-token';

/**
 * Queries the wallet account balance.
 *
 * @param currency The currency to query the balance for. Defaults to `SOL`.
 * Can be a token symbol or mint {@link Address}.
 * @returns A {@link Promise} that resolves to the wallet account balance (SOL).
 */
export async function getWalletBalance(currency: TokenQuery = 'SOL'): Promise<number> {
  const currencyTokenMeta = await getTokenMeta(currency);
  if (!currencyTokenMeta) {
    throw new Error(`Failed to fetch token metadata for query: ${currency}`);
  }

  let amount = 0;

  if (currencyTokenMeta.symbol === 'SOL') {
    const lamports = await rpc().getBalance(anchor().publicKey);
    amount = toSol(lamports);
  } else {
    // Fetch the desired token account
    const tokenAccounts = await _getWalletTokenAccounts();
    const tokenAccount = tokenAccounts.find(
      (account) => account.mint.toBase58() === currencyTokenMeta?.address
    );

    // Convert the token amount to a number
    amount = DecimalUtil.fromBN(
      new BN(tokenAccount?.amount.toString() ?? '0'),
      currencyTokenMeta.decimals
    ).toNumber();
  }

  debug('Wallet balance:', amount, currencyTokenMeta?.symbol);
  return amount;
}

async function _getWalletTokenAccounts(): Promise<Account[]> {
  const response = await rpc().getTokenAccountsByOwner(
    anchor().publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  return response.value.map((responseData) =>
    unpackAccount(responseData.pubkey, responseData.account)
  );
}
