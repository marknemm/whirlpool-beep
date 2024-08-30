import { debug, expBackoff, numericToNumber, tokenAmountToUSD, warn } from '@npc/core';
import { decodeTransaction } from '@npc/solana/util/program/program';
import type { DecodedTransactionIx, TokenTransfer } from '@npc/solana/util/program/program.interfaces';
import rpc from '@npc/solana/util/rpc/rpc';
import { getToken, getTokenPrice } from '@npc/solana/util/token/token';
import { ComputeBudget, type SendTransactionResult } from '@npc/solana/util/transaction-context/transaction-context';
import { toLamports } from '@npc/solana/util/unit-conversion/unit-conversion';
import wallet from '@npc/solana/util/wallet/wallet';
import { ComputeBudgetProgram, SetComputeUnitLimitParams, SetComputeUnitPriceParams, VersionedTransactionResponse, type TransactionSignature } from '@solana/web3.js';
import BN from 'bn.js';
import type { TransferTotals, TxSummary } from './transaction-query.interfaces';

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
 * @param sendResult The {@link SendTransactionResult} for the transaction.
 * @returns A {@link Promise} that resolves to the summary of the transaction.
 */
export async function getTxSummary(sendResult: SendTransactionResult): Promise<TxSummary>;

/**
 * Gets the summary of a transaction.
 *
 * @param signature The {@link TransactionSignature} for the transaction.
 * @returns A {@link Promise} that resolves to the summary of the transaction.
 */
export async function getTxSummary(signature: TransactionSignature): Promise<TxSummary>;

/**
 * Gets the summary of a transaction.
 *
 * @param sendResultOrSignature The {@link SendTransactionResult} or {@link TransactionSignature} for the transaction.
 * @returns A {@link Promise} that resolves to the summary of the transaction.
 */
export async function getTxSummary(
  sendResultOrSignature: TransactionSignature | SendTransactionResult,
): Promise<TxSummary> {
  // Extract individual arguments
  const sendResult = (typeof sendResultOrSignature !== 'string')
    ? sendResultOrSignature
    : undefined;
  const signature = sendResult?.signature ?? sendResultOrSignature as string;

  if (!_txSummaryCache.has(signature)) {
    debug('Generating Tx Summary...');

    const txSummary: TxSummary = {
      blockTime: new Date(),
      computeBudget: {},
      computeUnitsConsumed: 0,
      decodedIxs: [],
      fee: 0,
      priorityFee: 0,
      signature,
      sendResult,
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
        // Assign decoded instructions
        txSummary.decodedIxs = await decodeTransaction({ transaction, meta, signature });

        // Assign transaction compute budget data
        txSummary.computeBudget = sendResult?.buildRecord.computeBudget
          ?? await getComputeBudget(signature);

        // Assign token transfer data
        txSummary.transfers = await getTransfers(signature);
        const { tokenTotals, usd } = await getTransferTotals(signature);
        txSummary.tokens = tokenTotals;
        txSummary.usd = usd;
      } catch (err) {
        warn('Error decoding transaction instructions:', err);
      }
    } else {
      warn('Transaction not found:', signature);
    }

    _txSummaryCache.set(signature, txSummary);
  }

  const txSummary = _txSummaryCache.get(signature)!;
  txSummary.sendResult ??= sendResult;
  return txSummary;
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
  const decodedIxs = await decodeTransaction({ ...txResponse, signature });

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
          numericToNumber(computeUnitPriceMicroLamports) * computeUnitLimit,
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
  const decodedIxs = await decodeTransaction({ ...txResponse, signature });

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
    .flatMap((ix) => [ix, ...ix.innerInstructions]) // Flatten ixs and inner ixs
    .filter((ix) => ix.name === 'Transfer')         // Filter for transfer instructions
    .map((ix) => ix.data as TokenTransfer);         // Map to transfer data
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
  const tokenTotals = new Map<string, BN>();
  let usd = 0;

  // Calculate total token transfer amount deltas and USD delta
  for (const transfer of transfers) {
    // Add token delta to total token delta
    const baseAmount = tokenTotals.get(transfer.keys.mint) ?? new BN(0);
    const deltaAmount = (transfer.keys.destinationOwner === wallet().publicKey.toBase58())
      ? transfer.amount
      : transfer.amount.neg();
    tokenTotals.set(transfer.keys.mint, baseAmount.add(deltaAmount));

    // Add token delta to total USD delta
    const token = await getToken(transfer.keys.mint);
    const tokenPrice = await getTokenPrice(token);
    usd += tokenAmountToUSD(deltaAmount, tokenPrice, token?.mint.decimals).toNumber();
  }

  return { tokenTotals, usd };
}

export type * from './transaction-query.interfaces';
