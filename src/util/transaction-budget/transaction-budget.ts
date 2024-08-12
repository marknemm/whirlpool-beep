import type { Null } from '@/interfaces/nullable.interfaces';
import env from '@/util/env/env';
import { debug, error } from '@/util/log/log';
import { toLamports, toMicroLamports } from '@/util/number-conversion/number-conversion';
import rpc from '@/util/rpc/rpc';
import wallet from '@/util/wallet/wallet';
import { getSimulationComputeUnits } from '@solana-developers/helpers';
import { ComputeBudgetProgram, Transaction, type PublicKey, type TransactionInstruction } from '@solana/web3.js';
import axios from 'axios';
import type { ComputeBudget, ComputeBudgetOptions, PriorityFeeEstimate, PriorityFeeEstimateResponse, TransactionPriority } from './transaction-budget.interfaces';

/**
 * Generates a {@link ComputeBudget} for a transaction.
 *
 * @param ixs The {@link TransactionInstruction}s to generate the {@link ComputeBudget} instructions for.
 * @param opts The {@link ComputeBudgetOptions} to use for generating the {@link ComputeBudget} instructions.
 * Defaults to {@link env.PRIORITY_LEVEL_DEFAULT}.
 * @param retry The send transaction retry count used to boost the generated priority fee. Defaults to `0`.
 * @returns A {@link Promise} that resolves to the generated {@link ComputeBudget} {@link TransactionInstruction}s.
 */
export async function genComputeBudget(
  ixs: readonly TransactionInstruction[],
  opts: ComputeBudgetOptions = env.PRIORITY_LEVEL_DEFAULT,
  retry = 0
): Promise<ComputeBudget> {
  const computeBudget: ComputeBudget = {
    computeUnitLimit: (opts as ComputeBudget)?.computeUnitLimit
      ?? await getComputeLimitEstimate(ixs),
    instructions: [],
    priorityFeeLamports: (opts as ComputeBudget)?.priorityFeeLamports,
  };

  if (!computeBudget.priorityFeeLamports && computeBudget.computeUnitLimit) {
    let priority = (opts as TransactionPriority)
      ?? (opts as { priority: TransactionPriority })?.priority
      ?? env.PRIORITY_LEVEL_DEFAULT;
    if (retry) { // Every 2 retries, increase the priority level - caps at 'veryHigh'
      priority = getNextPriorityLevel(priority, Math.floor(retry / 2));
    }

    const priorityFeeEstimate = await getPriorityFeeEstimate(ixs);
    const priorityFeeEstimateLamports = toLamports(priorityFeeEstimate[priority], 'Micro Lamports');
    const priorityFeeEstimateTotal = Math.ceil(priorityFeeEstimateLamports * computeBudget.computeUnitLimit);

    computeBudget.priorityFeeLamports = Math.min(
      Math.ceil(
        Math.max(
          priorityFeeEstimateTotal,
          env.PRIORITY_FEE_MIN_LAMPORTS
        ) * (retry * 0.1 + 1)
      ),
      env.PRIORITY_FEE_MAX_LAMPORTS
    );
  }

  if (computeBudget.computeUnitLimit) {
    computeBudget.instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeBudget.computeUnitLimit,
      })
    );
  }

  if (computeBudget.priorityFeeLamports && computeBudget.computeUnitLimit) {
    const microLamportsTotal = toMicroLamports(computeBudget.priorityFeeLamports, 'Lamports');

    computeBudget.instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.floor(microLamportsTotal / computeBudget.computeUnitLimit),
      })
    );
  }

  return computeBudget;
}

/**
 * Simulates a transaction to estimate the max `CU` (compute units) required to execute it.
 *
 * @param ixs The {@link TransactionInstruction}s to simulate.
 * @returns A {@link Promise} that resolves to the estimated `CU` required to execute the transaction.
 * If the transaction simulation fails, resolves to `null`.
 */
export async function getComputeLimitEstimate(
  ixs: readonly TransactionInstruction[]
): Promise<number | undefined> {
  debug('Estimating Compute Units via transaction simulation...');

  let computeUnits = await getSimulationComputeUnits(rpc(), [...ixs], wallet().publicKey, []) ?? undefined;

  computeUnits = computeUnits
    ? Math.floor(computeUnits * (1 + (env.COMPUTE_LIMIT_MARGIN / 100))) // Add buffer in case extra CU are needed for PDA ops.
    : undefined;

  debug('Estimated Compute Units:', computeUnits);

  return computeUnits;
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
 * @param ixs The {@link TransactionInstruction}s to get the {@link PriorityFeeEstimate} for.
 * If provided, will attempt to generate a priority fee based on specific instructions.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
export async function getPriorityFeeEstimate(
  ixs?: readonly TransactionInstruction[] | Null
): Promise<PriorityFeeEstimate> {
  if (env.HELIUS_API_KEY && env.NODE_ENV === 'production') {
    try {
      return await getHeliusPriorityFeeEstimate(ixs);
    } catch(err) {
      error('Failed to fetch priority fee estimate:', err);
    }
  }

  try {
    return await getFallbackPriorityFeeEstimate(ixs);
  } catch(err) {
    error('Failed to fetch fallback priority fee estimate:', err);
  }

  return { min: 0, low: 0, medium: 0, high: 0, veryHigh: 0, unsafeMax: 0 };
}

/**
 * Fetches the {@link PriorityFeeEstimate} via the Helius API.
 *
 * @param ixs The {@link TransactionInstruction}s {@link PriorityFeeEstimate} for.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
export async function getHeliusPriorityFeeEstimate(
  ixs?: readonly TransactionInstruction[] | Null
): Promise<PriorityFeeEstimate> {
  if (!env.HELIUS_API_KEY) {
    throw new Error('HELIUS_API_KEY env var not set, cannot fetch priority fee via Helius RPC endpoint');
  }

  debug('Fetching priority fee estimate via Helius RPC Endpoint:', env.HELIUS_RPC_ENDPOINT);

  const lockedWritableAccounts = _getWriteableAccounts(ixs);

  const response = await axios.post<PriorityFeeEstimateResponse>(env.HELIUS_RPC_ENDPOINT, {
    jsonrpc: '2.0',
    id: '1',
    method: 'getPriorityFeeEstimate',
    params: [{
      accountKeys: lockedWritableAccounts?.map((key) => key.toBase58()) ?? undefined,
      options: {
        includeAllPriorityFeeLevels: true,
      },
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
 * @param ixs The {@link TransactionInstruction}s to get the {@link PriorityFeeEstimate} for.
 * @returns A {@link Promise} that resolves to the {@link PriorityFeeEstimate}.
 */
export async function getFallbackPriorityFeeEstimate(
  ixs?: readonly TransactionInstruction[] | Null
): Promise<PriorityFeeEstimate> {
  debug('Fetching fallback priority fee estimate via RPC:', 'getRecentPrioritizationFees');

  const lockedWritableAccounts = _getWriteableAccounts(ixs);
  const fallbackResponse = await rpc().getRecentPrioritizationFees({ lockedWritableAccounts });
  const sortedPriorityFees = fallbackResponse.map((value) => value.prioritizationFee).sort((a, b) => a - b);

  const estimate = {
    min: sortedPriorityFees[0],
    low: sortedPriorityFees[Math.floor(fallbackResponse.length / 4)],
    medium: sortedPriorityFees[Math.floor(fallbackResponse.length / 2)],
    high: sortedPriorityFees[Math.floor((fallbackResponse.length / 4) * 3)],
    veryHigh: sortedPriorityFees[Math.floor(fallbackResponse.length * 0.9)],
    unsafeMax: sortedPriorityFees[sortedPriorityFees.length - 1],
  };

  debug('Fallback priority fee estimate:', estimate);
  return estimate;
}

/**
 * Gets the writeable accounts for a transaction.
 *
 * @param ixs The {@link TransactionInstruction}s to get the writeable accounts for.
 * @returns A {@link Promise} that resolves to an array of {@link PublicKey}s for the writeable accounts.
 */
function _getWriteableAccounts(
  ixs?: readonly TransactionInstruction[] | Null
): PublicKey[] | undefined {
  if (!ixs?.length) return undefined;

  return ixs
    .flatMap((ix) => ix.keys)
    .filter((key) => key.isWritable)
    .map((key) => key.pubkey);
}

export type * from './transaction-budget.interfaces';

