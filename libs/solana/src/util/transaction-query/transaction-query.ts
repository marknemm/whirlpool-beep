import { debug, expBackoff, toNumber, tokenAmountToUSD, warn } from '@npc/core';
import { addressEquals } from '@npc/solana/util/address/address';
import type { ComputeBudget } from '@npc/solana/util/compute-budget/compute-budget.interfaces';
import { decodeTransaction } from '@npc/solana/util/program/program';
import type { DecodedTransactionIx, TokenTransfer } from '@npc/solana/util/program/program.interfaces';
import rpc from '@npc/solana/util/rpc/rpc';
import { getToken, getTokenPrice } from '@npc/solana/util/token/token';
import { toLamports } from '@npc/solana/util/unit-conversion/unit-conversion';
import wallet from '@npc/solana/util/wallet/wallet';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ComputeBudgetProgram, SetComputeUnitLimitParams, SetComputeUnitPriceParams, VersionedTransactionResponse, type TransactionSignature } from '@solana/web3.js';
import BN from 'bn.js';
import type { IxSummary, TransferTotals, TxSummary } from './transaction-query.interfaces';

const _txCache = new Map<string, VersionedTransactionResponse>();
const _txSummaryCache = new Map<string, TxSummary>();

/**
 * Gets a transaction by its {@link signature}.
 *
 * @param signature The signature of the transaction to get.
 * @returns A {@link Promise} that resolves to the {@link VersionedTransactionResponse};
 * `undefined` if the transaction cannot be retrieved.
 */
export async function getTransaction(
  signature: TransactionSignature,
): Promise<VersionedTransactionResponse | undefined> {
  debug('Getting Tx:', signature);

  return expBackoff(
    async () => {
      if (!_txCache.has(signature)) {
        const tx = await rpc().getTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (tx) {
          _txCache.set(signature, tx);
        }
      }
      return _txCache.get(signature);
    },
    { retryFilter: (result, err) => !result || !!err }
  );
}

/**
 * Gets the summary of a transaction.
 *
 * @param signature The {@link TransactionSignature} for the transaction.
 * @returns A {@link Promise} that resolves to the {@link TxSummary}.
 */
export async function getTxSummary(signature: TransactionSignature): Promise<TxSummary> {
  if (!_txSummaryCache.has(signature)) {
    debug('Generating Tx Summary:', signature);

    const txSummary: TxSummary = {
      blockTime: new Date(),
      computeBudget: {},
      computeUnitsConsumed: 0,
      fee: 0,
      instructions: [],
      priorityFee: 0,
      signature,
      size: 0,
      tokens: new Map<string, BN>(),
      transfers: [],
      usd: 0,
    };

    const txResponse = await getTransaction(signature);

    if (txResponse) {
      // Assign transaction metadata
      const { blockTime, meta, transaction } = txResponse;

      // Assign transaction metadata
      txSummary.blockTime = new Date((blockTime ?? 0) * 1000 || Date.now());
      txSummary.computeUnitsConsumed = meta?.computeUnitsConsumed ?? 0;
      txSummary.size = transaction.message.serialize().length;

      // Assign transaction fee data
      const baseFee = transaction.signatures.length * 5000;
      txSummary.fee = meta?.fee ?? baseFee;
      txSummary.priorityFee = txSummary.fee - baseFee;

      // Decode instructions with best attempt - do not throw errors if decode fails
      try {
        // Assign decoded instruction summaries
        const decodedIxs = await decodeTransaction({ ...transaction, meta, signature });
        txSummary.instructions = await Promise.all(decodedIxs.map((ix) => getIxSummary(ix)));

        // Assign transaction compute budget data
        txSummary.computeBudget = await getComputeBudget(signature);

        // Assign token transfer data
        txSummary.transfers = await getTransfers(signature);
        const { tokens, usd } = await getTransferTotals(signature);
        txSummary.tokens = tokens;
        txSummary.usd = usd;
      } catch (err) {
        warn('Error decoding transaction instructions:', err);
      }
    } else {
      warn('Transaction not found:', signature);
    }

    _txSummaryCache.set(signature, txSummary);
  }

  return _txSummaryCache.get(signature)!;
}

/**
 * Gets the summary of a decoded instruction.
 *
 * @param decodedIx The {@link DecodedTransactionIx} to get the summary of.
 * @returns A {@link Promise} that resolves to the {@link IxSummary}.
 */
export async function getIxSummary(decodedIx: DecodedTransactionIx): Promise<IxSummary> {
  const transfers = getTransfersFromIxs([decodedIx]);
  const { tokens, usd } = await calcTransferTotals(transfers);

  return {
    ...decodedIx,
    transfers,
    tokens,
    usd,
  };
}

/**
 * Gets the compute budget of a transaction.
 *
 * @param signature The {@link TransactionSignature}.
 * @returns A {@link Promise} that resolves to the partial {@link ComputeBudget} of the transaction.
 * If the transaction cannot be retrieved, returns `{}`.
 */
export async function getComputeBudget(
  signature: TransactionSignature
): Promise<Partial<ComputeBudget>> {
  const txResponse = await getTransaction(signature);
  if (!txResponse) return {};

  const { meta, transaction } = txResponse;
  const decodedIxs = await decodeTransaction({ ...transaction, meta, signature });

  const computeUnitLimitParams = decodedIxs.find((ix) =>
       ix.programId === ComputeBudgetProgram.programId
    && ix.name === 'SetComputeUnitLimit'
  )?.data as SetComputeUnitLimitParams;

  const computeUnitPriceParams = decodedIxs.find((ix) =>
       ix.programId === ComputeBudgetProgram.programId
    && ix.name === 'SetComputeUnitPrice'
  )?.data as SetComputeUnitPriceParams;

  const computeBudget: Partial<ComputeBudget> = {};
  const computeUnitLimit = computeUnitLimitParams?.units;

  if (computeUnitLimit) {
    computeBudget.computeUnitLimit = computeUnitLimit;

    const computeUnitPriceMicroLamports = computeUnitPriceParams?.microLamports;
    if (computeUnitPriceMicroLamports) {
      computeBudget.priorityFeeLamports = Math.round(
        toLamports(
          toNumber(computeUnitPriceMicroLamports) * computeUnitLimit,
          'Micro Lamports'
        )
      );
    }
  }

  return computeBudget;
}

/**
 * Gets the token transfers of a transaction.
 *
 * @param signature The {@link TransactionSignature} for the transaction.
 * @returns A {@link Promise} that resolves to the token transfers of the transaction.
 */
export async function getTransfers(
  signature: TransactionSignature,
): Promise<TokenTransfer[]> {
  // Get transaction (with cache)
  const txResponse = await getTransaction(signature);
  if (!txResponse) return [];

  // Decode instructions (with cache)
  const { meta, transaction } = txResponse;
  const decodedIxs = await decodeTransaction({ ...transaction, meta, signature });

  // Extract transfer data
  return getTransfersFromIxs(decodedIxs);
}

/**
 * Gets the token transfers from decoded instructions.
 *
 * @param decodedIxs The {@link DecodedTransactionIx} to get transfers from.
 * @returns The {@link TokenTransfer}s from the decoded instructions.
 */
export function getTransfersFromIxs(decodedIxs: DecodedTransactionIx[]): TokenTransfer[] {
  return decodedIxs
    .flatMap((ix) => [ix, ...ix.innerInstructions])  // Flatten ixs and inner ixs
    .filter((ix) =>                                  // Filter token program ixs
      addressEquals(ix.programId, TOKEN_PROGRAM_ID)
      && ['Transfer', 'TransferChecked'].includes(ix.name)
    )
    .map((ix) => ix.data as TokenTransfer); // Map to transfer data
}

/**
 * Gets the total token transfer amounts and USD delta of a transaction.
 *
 * @param signature The {@link TransactionSignature} for the transaction.
 * @returns A {@link Promise} that resolves to the {@link TransferTotals} of the transaction.
 */
export async function getTransferTotals(
  signature: TransactionSignature,
): Promise<TransferTotals> {
  const txTransfers = await getTransfers(signature);
  return calcTransferTotals(txTransfers);
}

/**
 * Gets the total token transfer amounts and USD delta from decoded instructions.
 *
 * @param decodedIxs The {@link DecodedTransactionIx} to get transfer totals from.
 * @returns A {@link Promise} that resolves to the {@link TransferTotals}.
 */
export async function getTransferTotalsFromIxs(
  decodedIxs: DecodedTransactionIx[]
): Promise<TransferTotals> {
  const txTransfers = getTransfersFromIxs(decodedIxs);
  return calcTransferTotals(txTransfers);
}

/**
 * Calculates the total token transfer amounts and USD delta.
 *
 * @param transfers The {@link TokenTransfer}s to calculate totals for.
 * @returns A {@link Promise} that resolves to the {@link TransferTotals}.
 */
export async function calcTransferTotals(transfers: TokenTransfer[]): Promise<TransferTotals> {
  const tokens = new Map<string, BN>();
  let usd = 0;

  // Calculate total token transfer amount deltas and USD delta
  for (const transfer of transfers) {
    // Add token delta to total token delta
    const baseAmount = tokens.get(transfer.keys.mint) ?? new BN(0);
    const deltaAmount = (transfer.keys.destinationOwner === wallet().publicKey.toBase58())
      ? transfer.amount
      : transfer.amount.neg();
    tokens.set(transfer.keys.mint, baseAmount.add(deltaAmount));

    // Add token delta to total USD delta
    const token = await getToken(transfer.keys.mint);
    const tokenPrice = await getTokenPrice(token);
    usd += tokenAmountToUSD(deltaAmount, tokenPrice, token?.mint.decimals).toNumber();
  }

  return { tokens, usd };
}

export type * from './transaction-query.interfaces';
