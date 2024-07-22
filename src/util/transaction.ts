import type { PriorityFeeEstimate, PriorityFeeEstimateResponse, TransactionBuildOptions, TransactionSendOptions, TransactionSummary } from '@/interfaces/transaction';
import { expBackoff } from '@/util/async';
import { encodeBase58 } from '@/util/encode';
import env from '@/util/env';
import { debug, error } from '@/util/log';
import { toNum, toUSD } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { getToken, getTokenPrice } from '@/util/token';
import wallet from '@/util/wallet';
import { AddressUtil, TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { getSimulationComputeUnits } from '@solana-developers/helpers';
import { Transaction, VersionedTransaction, type Commitment, type PublicKey, type TokenBalance, type TransactionInstruction, type VersionedTransactionResponse } from '@solana/web3.js';
import axios from 'axios';
import BN from 'bn.js';
import { green } from 'colors';

/**
 * Simulates a transaction to estimate the `CU` (compute units) required to execute it.
 *
 * @param tx The transaction to simulate. Either a {@link TransactionBuilder} or an array of {@link TransactionInstruction}s.
 * @returns A {@link Promise} that resolves to the estimated `CU` required to execute the transaction.
 * If the transaction simulation fails, resolves to `null`.
 */
export async function getComputeUnitEstimate(
  tx: TransactionBuilder | TransactionInstruction[]
): Promise<number | undefined> {
  const instructions = tx instanceof TransactionBuilder
    ? tx.compressIx(true).instructions
    : tx;

  debug('Estimating Compute Units via transaction simulation...');

  let minComputeUnits = await getSimulationComputeUnits(rpc(), instructions, wallet().publicKey, []) ?? undefined;

  minComputeUnits = minComputeUnits
    ? Math.floor(minComputeUnits * 1.1) // Add 10% buffer
    : undefined;

  debug('Estimated Compute Units:', minComputeUnits);

  return minComputeUnits;
}

/**
 * Gets the {@link PriorityFeeEstimate} for a transaction.
 *
 * @param tx The transaction to get the {@link PriorityFeeEstimate} for. Either a {@link TransactionBuilder} or a {@link Transaction}.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
export async function getPriorityFeeEstimate(
  tx: Transaction | VersionedTransaction | TransactionBuilder
): Promise<PriorityFeeEstimate> {
  tx = (tx instanceof TransactionBuilder)
    ? (await tx.build()).transaction
    : tx;

  if (env.HELIUS_API_KEY && env.NODE_ENV === 'production') {
    try {
      return await _getHeliusPriorityFeeEstimate(tx);
    } catch(err) {
      error('Failed to fetch priority fee estimate:', err);
    }
  }

  try {
    return await _getFallbackPriorityFeeEstimate(tx);
  } catch(err) {
    error('Failed to fetch fallback priority fee estimate:', err);
  }

  return { min: 0, low: 0, medium: 0, high: 0, veryHigh: 0, unsafeMax: 0 };
}

/**
 * Fetches the {@link PriorityFeeEstimate} via the Helius API.
 *
 * @param tx The transaction to get the {@link PriorityFeeEstimate} for.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
async function _getHeliusPriorityFeeEstimate(
  tx: Transaction | VersionedTransaction
): Promise<PriorityFeeEstimate> {
  debug('Fetching priority fee estimate via Helius API:', env.HELIUS_API);

  const response = await axios.post<PriorityFeeEstimateResponse>(env.HELIUS_API, {
    jsonrpc: '2.0',
    id: '1',
    method: 'getPriorityFeeEstimate',
    params: [{
      options: { includeAllPriorityFeeLevels: true },
      transaction: encodeBase58(tx.serialize()),
    }]
  }, {
    headers: { 'Content-Type': 'application/json' },
    params: { 'api-key': env.HELIUS_API_KEY },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  debug('Helius priority fee estimate:', response.data.result.priorityFeeLevels.medium);
  return response.data.result.priorityFeeLevels;
}

/**
 * Fetches the {@link PriorityFeeEstimate} via a fallback RPC call.
 *
 * @param tx The transaction to get the {@link PriorityFeeEstimate} for.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
async function _getFallbackPriorityFeeEstimate(
  tx: Transaction | VersionedTransaction
): Promise<PriorityFeeEstimate> {
  debug('Fetching fallback priority fee estimate via RPC fallback:', 'getRecentPrioritizationFees');

  const lockedWritableAccounts = getWriteableAccounts(tx);
  const fallbackResponse = await rpc().getRecentPrioritizationFees({ lockedWritableAccounts });

  const total = fallbackResponse.reduce((prev, current) => prev + current.prioritizationFee, 0);
  const mean = total / fallbackResponse.length;
  const squaredDiffs = fallbackResponse.map((value) => (value.prioritizationFee - mean) ** 2);
  const variance = squaredDiffs.reduce((prev, current) => prev + current, 0) / fallbackResponse.length;

  debug('Fallback priority fee estimate:', mean);

  return {
    min: Math.max(mean - (2 * variance), 0),
    low: Math.max(mean - variance, 0),
    medium: mean,
    high: mean + variance,
    veryHigh: mean + (2 * variance),
    unsafeMax: mean + (3 * variance),
  };
}

/**
 * Gets the writeable accounts for a transaction.
 *
 * @param tx The transaction to get the writeable accounts for. Either a {@link Transaction} or a {@link VersionedTransaction}.
 * @returns A {@link Promise} that resolves to an array of {@link PublicKey}s for the writeable accounts.
 */
export function getWriteableAccounts(tx: Transaction | VersionedTransaction): PublicKey[] {
  const lockedWritableAccounts = (tx instanceof Transaction)
    ? tx.instructions
      .flatMap((ix) => ix.keys)
      .filter((key) => key.isWritable)
      .map((key) => key.pubkey)
    : [];

  if (tx instanceof VersionedTransaction) {
    const accountKeys = tx.message.getAccountKeys();
    for (let i = 0; i < accountKeys.length; i++) {
      if (tx.message.isAccountWritable(i)) {
        lockedWritableAccounts.push(accountKeys.get(i)!);
      }
    }
  }

  return lockedWritableAccounts;
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
  if (!buildOpts.computeBudgetOption) {
    buildOpts.computeBudgetOption = {
      computeBudgetLimit: await getComputeUnitEstimate(tx),
      priorityFeeLamports: (await getPriorityFeeEstimate(tx))[buildOpts.priority ?? 'medium'],
      type: 'fixed',
    };
  }
  buildOpts.blockhashCommitment = 'finalized';

  debug('Executing Tx with compute budget:', buildOpts.computeBudgetOption);
  const signature = await tx.buildAndExecute(buildOpts, sendOpts);

  await verifyTransaction(signature, sendOpts.commitment);

  debug('Tx executed and verified:', signature);
  return signature;
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
