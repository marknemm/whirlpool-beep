import type { TransactionBuildOptions, TransactionSendOptions, TransactionSummary } from '@/interfaces/transaction';
import { expBackoff } from '@/util/async';
import { debug, error, info } from '@/util/log';
import { toNum, toUSD } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { getToken, getTokenPrice } from '@/util/token';
import { genComputeBudget } from '@/util/transaction-budget';
import wallet from '@/util/wallet';
import { AddressUtil, TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { SendTransactionError, type Commitment, type TokenBalance, type VersionedTransactionResponse } from '@solana/web3.js';
import BN from 'bn.js';
import { green } from 'colors';

/**
 * Executes a given transaction.
 *
 * @param tx The transaction to execute.
 * @param buildOpts The {@link TransactionBuildOptions} to use for building the transaction.
 * @param sendOpts The {@link TransactionSendOptions} to use for sending the transaction.
 * @returns A {@link Promise} that resolves to the signature of the executed transaction.
 * @throws An {@link Error} if the transaction execution fails.
 */
export async function executeTransaction(
  tx: TransactionBuilder,
  buildOpts: TransactionBuildOptions = {},
  sendOpts: TransactionSendOptions = {}
): Promise<string> {
  buildOpts.computeBudgetOption ??= await genComputeBudget(tx, buildOpts);

  return await expBackoff(
    async (retry: number) => {
      // Retry with a new compute budget if the transaction expired
      if (retry > 0) {
        buildOpts.computeBudgetOption = await genComputeBudget(tx, buildOpts, retry);
      }

      info('Executing Tx with compute budget:', buildOpts.computeBudgetOption);

      const signature = await tx.buildAndExecute(buildOpts, sendOpts);
      await verifyTransaction(signature, sendOpts.commitment);

      info('Tx executed and verified:', signature);
      return signature;
    },
    {
      baseDelay: 1000,
      retryFilter: (result, err) =>
        !!(err as SendTransactionError)?.stack?.includes('TransactionExpiredBlockheightExceededError'),
    }
  );
}

/**
 * Verifies a blockchain transaction by waiting for it to be confirmed.
 *
 * @param signature The signature of the transaction to verify.
 * @param commitment The commitment level to use for the verification. Defaults to `finalized`.
 * @returns A {@link Promise} that resolves when the transaction is confirmed.
 * @throws An {@link Error} if the transaction cannot be confirmed.
 */
export async function verifyTransaction(signature: string, commitment: Commitment = 'finalized'): Promise<void> {
  debug(`Verifying Tx ( Commitment: ${green(commitment)} ):`, signature);

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
 * @returns A {@link Promise} that resolves to the {@link VersionedTransactionResponse};
 * `null` if the transaction cannot be retrieved.
 */
export async function getTransaction(
  signature: string,
): Promise<VersionedTransactionResponse | null> {
  debug('Getting Tx:', signature);

  return expBackoff(
    () => rpc().getTransaction(signature, { maxSupportedTransactionVersion: 0 }),
    { retryFilter: (result, err) => !result || !!err }
  );
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
  debug('Generating Tx Summary...');

  const txSummary: TransactionSummary = {
    fee: 0,
    signature,
    tokens: new Map<string, BN>(),
    usd: 0,
  };

  const transaction = await getTransaction(signature);
  if (!transaction?.meta?.preTokenBalances || !transaction.meta.postTokenBalances) {
    error('Transaction token balances not found:', signature);
    return txSummary;
  }

  txSummary.fee = transaction.meta.fee;

  tokens = tokens.map((addr) => AddressUtil.toString(addr));

  // Extract token balance and total USD deltas from the transaction
  for (let i = 0; i < transaction.meta.preTokenBalances.length && tokens.length; i++) {
    const preBalance = transaction.meta.preTokenBalances[i];
    const postBalance = transaction.meta.postTokenBalances[i];

    if (tokens.find((token) => token === preBalance.mint)) {
      tokens = tokens.filter((token) => token !== preBalance.mint);

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
      txSummary.tokens.set(preBalance.mint, tokenDelta);

      txSummary.usd += toNum(toUSD(tokenDelta, tokenPrice, token.mint.decimals));
    }
  }

  return txSummary;
}

function _calcDelta(preBalance: TokenBalance, postBalance: TokenBalance): BN {
  return (preBalance.owner === wallet().publicKey.toBase58())
    ? new BN(postBalance.uiTokenAmount.amount).sub(new BN(preBalance.uiTokenAmount.amount))
    : new BN(preBalance.uiTokenAmount.amount).sub(new BN(postBalance.uiTokenAmount.amount));
}
