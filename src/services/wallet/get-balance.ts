import type { TokenQuery } from '@/interfaces/token';
import { getToken } from '@/services/token/get-token';
import anchor from '@/util/anchor';
import { toNum, toSol } from '@/util/currency';
import { debug } from '@/util/log';
import rpc from '@/util/rpc';
import { type Address } from '@orca-so/common-sdk';
import { getWalletTokenAccount } from './get-token-account';

/**
 * Queries the wallet account balance.
 *
 * @param currency The currency to query the balance for. Defaults to `SOL`.
 * Can be a token symbol or mint {@link Address}.
 * @returns A {@link Promise} that resolves to the wallet account balance (SOL).
 */
export async function getWalletBalance(currency: TokenQuery = 'SOL'): Promise<number> {
  const currencyToken = await getToken(currency);
  if (!currencyToken) {
    throw new Error(`Failed to fetch token metadata for query: ${currency}`);
  }

  let amount = 0;

  if (currencyToken.metadata.symbol === 'SOL') {
    // Fetch the default wallet balance and convert Lamports to SOL
    const lamports = await rpc().getBalance(anchor().publicKey);
    amount = toSol(lamports);
  } else {
    // Fetch the desired token account and get amount
    const tokenAccount = await getWalletTokenAccount(currencyToken.mint.publicKey);
    amount = toNum(tokenAccount?.amount, currencyToken.mint.decimals);
  }

  debug('Wallet balance:', amount, currencyToken.metadata.symbol);
  return amount;
}
