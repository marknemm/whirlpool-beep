import type { Null } from '@/interfaces/nullable.interfaces';
import { encodeBase58 } from '@/util/encode/encode';
import env from '@/util/env/env';
import { debug, error } from '@/util/log/log';
import { toLamports } from '@/util/number-conversion/number-conversion';
import rpc from '@/util/rpc/rpc';
import type { TransactionBuildOptions } from '@/util/transaction/transaction.interfaces';
import wallet from '@/util/wallet/wallet';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { getSimulationComputeUnits } from '@solana-developers/helpers';
import { Transaction, VersionedTransaction, type PublicKey, type TransactionInstruction } from '@solana/web3.js';
import axios from 'axios';
import type { DeepReadonly } from 'utility-types';
import type { ComputeBudget, PriorityFeeEstimate, PriorityFeeEstimateResponse, TransactionPriority } from './transaction-budget.interfaces';

/**
 * Generates a {@link ComputeBudget} for a transaction.
 *
 * @param tx The {@link TransactionBuilder} to generate the {@link ComputeBudget} for.
 * @param buildOpts The {@link TransactionBuildOptions} used for the transaction.
 * @param retry The retry count for the transaction execution. Defaults to `0`.
 * @returns A {@link Promise} that resolves to the generated {@link ComputeBudget}.
 */
export async function genComputeBudget(
  tx: TransactionBuilder,
  buildOpts: DeepReadonly<TransactionBuildOptions> = {},
  retry = 0
): Promise<ComputeBudget> {
  const computeBudgetLimit = (buildOpts.computeBudgetOption as ComputeBudget)?.computeBudgetLimit
    ?? await getComputeLimitEstimate(tx);

  let priority = buildOpts.priority ?? env.PRIORITY_LEVEL_DEFAULT;
  if (retry) { // Every 2 retries, increase the priority level - caps at 'veryHigh'
    priority = getNextPriorityLevel(priority, Math.floor(retry / 2));
  }

  const priorityFeeEstimate = await getPriorityFeeEstimate(tx);
  const priorityFeeEstimateLamports = toLamports(priorityFeeEstimate[priority], 'Micro Lamports');

  const priorityFeeLamports = Math.min(
    Math.max(
      Math.ceil(priorityFeeEstimateLamports * (computeBudgetLimit ?? 0)),
      env.PRIORITY_FEE_MIN_LAMPORTS
    ) + (retry * env.PRIORITY_FEE_MIN_LAMPORTS),
    env.PRIORITY_FEE_MAX_LAMPORTS
  );

  return {
    computeBudgetLimit,
    priorityFeeLamports,
    type: 'fixed',
  };
}

/**
 * Simulates a transaction to estimate the max `CU` (compute units) required to execute it.
 *
 * @param tx The transaction to simulate. Either a {@link TransactionBuilder} or an array of {@link TransactionInstruction}s.
 * @returns A {@link Promise} that resolves to the estimated `CU` required to execute the transaction.
 * If the transaction simulation fails, resolves to `null`.
 */
export async function getComputeLimitEstimate(
  tx: TransactionBuilder | TransactionInstruction[]
): Promise<number | undefined> {
  const instructions = tx instanceof TransactionBuilder
    ? tx.compressIx(true).instructions
    : tx;

  debug('Estimating Compute Units via transaction simulation...');

  let minComputeUnits = await getSimulationComputeUnits(rpc(), instructions, wallet().publicKey, []) ?? undefined;

  minComputeUnits = minComputeUnits
    ? Math.floor(minComputeUnits * (1 + (env.COMPUTE_LIMIT_MARGIN / 100))) // Add buffer in case extra CU are needed for PDA ops.
    : undefined;

  debug('Estimated Compute Units:', minComputeUnits);

  return minComputeUnits;
}

/**
 * Gets the next priority level for a transaction. Caps at `veryHigh`.
 *
 * @param priority The current {@link TransactionPriority} to get the next priority level for.
 * @param jump The number of priority levels to jump forward by. Defaults to `1`.
 * Enter a negative number to jump backwards.
 * @returns The next {@link TransactionPriority}.
 */
export function getNextPriorityLevel(priority: TransactionPriority, jump = 1): TransactionPriority {
  const priorityLevels: TransactionPriority[] = ['min', 'low', 'medium', 'high', 'veryHigh'];
  const priorityIndex = priorityLevels.indexOf(priority);
  return priorityLevels[Math.max(priorityIndex + jump, priorityLevels.length - 1)];
}

/**
 * Gets the {@link PriorityFeeEstimate} for a transaction.
 *
 * @param tx The transaction to get the {@link PriorityFeeEstimate} for. Either a {@link TransactionBuilder} or a {@link Transaction}.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
export async function getPriorityFeeEstimate(
  tx?: Transaction | VersionedTransaction | TransactionBuilder | Null
): Promise<PriorityFeeEstimate> {
  tx = (tx instanceof TransactionBuilder)
    ? (await tx.build()).transaction
    : tx;

  if (env.HELIUS_API_KEY && env.NODE_ENV === 'production') {
    try {
      return await getHeliusPriorityFeeEstimate(tx);
    } catch(err) {
      error('Failed to fetch priority fee estimate:', err);
    }
  }

  try {
    return await getFallbackPriorityFeeEstimate();
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
export async function getHeliusPriorityFeeEstimate(
  tx?: Transaction | VersionedTransaction | Null
): Promise<PriorityFeeEstimate> {
  debug('Fetching priority fee estimate via Helius RPC Endpoint:', env.HELIUS_RPC_ENDPOINT);

  const response = await axios.post<PriorityFeeEstimateResponse>(env.HELIUS_RPC_ENDPOINT, {
    jsonrpc: '2.0',
    id: '1',
    method: 'getPriorityFeeEstimate',
    params: [{
      options: { includeAllPriorityFeeLevels: true },
      transaction: tx ? encodeBase58(tx.serialize()) : undefined,
    }]
  }, {
    headers: { 'Content-Type': 'application/json' },
    params: { 'api-key': env.HELIUS_API_KEY },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  debug('Helius priority fee estimate:', response.data.result.priorityFeeLevels);
  return response.data.result.priorityFeeLevels;
}

/**
 * Fetches the {@link PriorityFeeEstimate} via a fallback RPC call.
 *
 * @param tx The transaction to get the {@link PriorityFeeEstimate} for.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
export async function getFallbackPriorityFeeEstimate(
  tx?: Transaction | VersionedTransaction | Null
): Promise<PriorityFeeEstimate> {
  debug('Fetching fallback priority fee estimate via RPC:', 'getRecentPrioritizationFees');

  const lockedWritableAccounts = _getWriteableAccounts(tx);
  const fallbackResponse = await rpc().getRecentPrioritizationFees({ lockedWritableAccounts });

  const total = fallbackResponse.reduce((prev, current) => prev + current.prioritizationFee, 0);
  const mean = total / fallbackResponse.length;
  const squaredDiffs = fallbackResponse.map((value) => (value.prioritizationFee - mean) ** 2);
  const variance = squaredDiffs.reduce((prev, current) => prev + current, 0) / fallbackResponse.length;

  const estimate = {
    min: Math.max(mean - (2 * variance), 0),
    low: Math.max(mean - variance, 0),
    medium: mean,
    high: mean + variance,
    veryHigh: mean + (2 * variance),
    unsafeMax: mean + (3 * variance),
  };

  debug('Fallback priority fee estimate:', estimate);
  return estimate;
}

/**
 * Gets the writeable accounts for a transaction.
 *
 * @param tx The transaction to get the writeable accounts for. Either a {@link Transaction} or a {@link VersionedTransaction}.
 * @returns A {@link Promise} that resolves to an array of {@link PublicKey}s for the writeable accounts.
 */
function _getWriteableAccounts(
  tx?: Transaction | VersionedTransaction | Null
): PublicKey[] | undefined {
  if (!tx) return undefined;

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

export type { ComputeBudget } from '@/util/transaction/transaction.interfaces';
export type * from './transaction-budget.interfaces';

