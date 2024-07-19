import type { TransactionSummary } from '@/interfaces/transaction';
import { timeout } from '@/util/async';
import { debug, error, info } from '@/util/log';
import { toNum, toUSD } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { getToken, getTokenPrice } from '@/util/token';
import wallet from '@/util/wallet';
import { AddressUtil, type Address } from '@orca-so/common-sdk';
import { Commitment, type TokenBalance, type VersionedTransactionResponse } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * Verifies a blockchain transaction by waiting for it to be confirmed.
 *
 * @param signature The signature of the transaction to verify.
 * @param commitment The commitment level to use for the verification. Defaults to `finalized`.
 * @returns A {@link Promise} that resolves when the transaction is confirmed.
 * @throws An {@link Error} if the transaction cannot be confirmed.
 */
export async function verifyTransaction(signature: string, commitment: Commitment = 'finalized'): Promise<void> {
  info('Verifying Tx...');

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  const confirmResponse = await rpc().confirmTransaction({ signature, ...latestBlockhash }, commitment);

  if (confirmResponse.value.err) {
    throw new Error(confirmResponse.value.err.toString());
  }
}

/**
 * Gets a transaction by its {@link signature}.
 *
 * @param signature The signature of the transaction to get.
 * @param maxRetries The maximum number of retries to get the transaction. Defaults to `5`.
 * @returns A {@link Promise} that resolves to the {@link VersionedTransactionResponse};
 * `null` if the transaction cannot be retrieved.
 */
export async function getTransaction(
  signature: string,
  maxRetries = 10
): Promise<VersionedTransactionResponse | null> {
  debug('Getting Tx:', signature);
  let transaction = await rpc().getTransaction(signature, { maxSupportedTransactionVersion: 0 });

  let retry = 0;
  while (retry++ < maxRetries && (!transaction?.meta?.preTokenBalances || ! transaction.meta.postTokenBalances)) {
    await timeout(1000);
    transaction = await rpc().getTransaction(signature, { maxSupportedTransactionVersion: 0 });
  }

  return transaction;
}

/**
 * Gets the summary of a transaction.
 *
 * @param signature The signature of the transaction.
 * @param tokens The {@link Address}es of the tokens to collect summary data for.
 * @returns A {@link Promise} that resolves to the summary of the transaction.
 */
export async function getTransactionSummary(
  signature: string,
  tokens: Address[]
): Promise<TransactionSummary> {
  info('Generating Tx Summary...');

  const txDelta = {
    signature,
    tokens: new Map<string, BN>(),
    usd: 0,
  };

  const transaction = await getTransaction(signature);
  if (!transaction?.meta?.preTokenBalances || !transaction.meta.postTokenBalances) {
    error('Transaction token balances not found:', signature);
    return txDelta;
  }

  tokens = tokens.map((addr) => AddressUtil.toString(addr));

  for (let i = 0; i < transaction.meta.preTokenBalances.length; i++) {
    const preBalance = transaction.meta.preTokenBalances[i];
    const postBalance = transaction.meta.postTokenBalances[i];

    if (tokens.find((token) => token === preBalance.mint)) {
      const token = await getToken(preBalance.mint);
      if (!token) {
        error('Token not found for:', preBalance.mint);
        continue;
      }

      const tokenPrice = await getTokenPrice(token);
      if (!tokenPrice) {
        error('Token price not found for:', token.metadata.symbol);
        continue;
      }

      const tokenDelta = _calcDelta(preBalance, postBalance);
      txDelta.tokens.set(preBalance.mint, tokenDelta);

      txDelta.usd += toNum(toUSD(tokenDelta, tokenPrice, token.mint.decimals));
    }
  }

  return txDelta;
}

function _calcDelta(preBalance: TokenBalance, postBalance: TokenBalance): BN {
  return (preBalance.owner === wallet().publicKey.toBase58())
    ? new BN(postBalance.uiTokenAmount.amount).sub(new BN(preBalance.uiTokenAmount.amount))
    : new BN(preBalance.uiTokenAmount.amount).sub(new BN(postBalance.uiTokenAmount.amount));
}
