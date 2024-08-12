import { expBackoff } from '@/util/async/async';
import { debug, warn } from '@/util/log/log';
import { toNum, toUSD } from '@/util/number-conversion/number-conversion';
import { decodeIx } from '@/util/program/program';
import type { SplTokenTransferIxData, TempTokenAccount } from '@/util/program/program.interfaces';
import rpc from '@/util/rpc/rpc';
import { getToken, getTokenPrice } from '@/util/token/token';
import wallet from '@/util/wallet/wallet';
import { type ParsedTransactionWithMeta, type TransactionSignature } from '@solana/web3.js';
import BN from 'bn.js';
import type { DecodedTransactionIx, TransactionSummary, TransferTotals } from './transaction-query.interfaces';

const _txCache = new Map<string, ParsedTransactionWithMeta>();
const _txSummaryCache = new Map<string, TransactionSummary>();

/**
 * Gets a transaction by its {@link signature}.
 *
 * @param signature The signature of the transaction to get.
 * @returns A {@link Promise} that resolves to the {@link VersionedTransactionResponse};
 * `undefined` if the transaction cannot be retrieved.
 */
export async function getTransaction(
  signature: TransactionSignature,
): Promise<ParsedTransactionWithMeta | undefined> {
  debug('Getting Tx:', signature);

  return expBackoff(
    async () => {
      if (!_txCache.has(signature)) {
        const tx = await rpc().getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
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
 * @param signature The signature of the transaction.
 * @returns A {@link Promise} that resolves to the summary of the transaction.
 */
export async function getTransactionSummary(
  signature: TransactionSignature,
): Promise<TransactionSummary> {
  if (!_txSummaryCache.has(signature)) {
    debug('Generating Tx Summary...');

    const txSummary: TransactionSummary = {
      fee: 0,
      signature,
      tokens: new Map<string, BN>(),
      decodedIxs: [],
      usd: 0,
    };

    const transaction = await getTransaction(signature);

    if (transaction?.meta?.innerInstructions?.length) {
      txSummary.fee = transaction.meta.fee;
      txSummary.decodedIxs = await getDecodedTransactionIxs(transaction);

      const { tokenTotals, usd } = await getTransactionTransferTotals(txSummary.decodedIxs);
      txSummary.tokens = tokenTotals;
      txSummary.usd = usd;
    } else {
      warn('Transaction inner instructions not found:', signature);
    }

    _txSummaryCache.set(signature, txSummary);
  }

  return _txSummaryCache.get(signature)!;
}

/**
 * Gets the decoded instructions of a transaction.
 *
 * @param tx The transaction to get the decoded instructions of.
 * @returns A {@link Promise} that resolves to the decoded instructions of the transaction.
 */
export async function getDecodedTransactionIxs(tx: ParsedTransactionWithMeta): Promise<DecodedTransactionIx[]> {
  const innerIxs = tx?.meta?.innerInstructions ?? [];
  const rawIxs = tx?.transaction.message.instructions ?? [];
  const ixs: DecodedTransactionIx[] = [];
  const tempTokenAccounts = new Map<string, TempTokenAccount>();

  for (let i = 0; i < rawIxs.length; i++) {
    const rawIx = rawIxs[i];
    const decodedIx = await decodeIx(rawIx, tempTokenAccounts);
    if (decodedIx) {
      // Record any potential temp token accounts created during the transaction
      if (decodedIx.programName === 'spl-token' && decodedIx.name === 'initializeAccount') {
        const initAccountData = decodedIx.data as TempTokenAccount;
        tempTokenAccounts.set(initAccountData.account, initAccountData);
      }

      const rawInnerIxs = innerIxs.find((innerIx) => innerIx.index === i)?.instructions ?? [];
      decodedIx.innerInstructions ??= [];

      for (const rawInnerIx of rawInnerIxs) {
        const decodedInnerIx = await decodeIx(rawInnerIx, tempTokenAccounts);
        if (decodedInnerIx) {
          decodedIx.innerInstructions.push(decodedInnerIx);
        }
      }
    }
    ixs.push(decodedIx);
  }

  return ixs;
}

/**
 * Gets the total token transfer amounts and USD delta of a transaction.
 *
 * @param decodedIxs The {@link DecodedTransactionIx Decoded Instructions} of the transaction.
 * @returns A {@link Promise} that resolves to the {@link TransferTotals} of the transaction.
 */
export async function getTransactionTransferTotals(
  decodedIxs: DecodedTransactionIx[],
): Promise<TransferTotals> {
  const tokenTotals = new Map<string, BN>();
  let usd = 0;

  // Calculate total token transfer amount deltas and USD delta
  for (const ix of decodedIxs) {
    for (const innerIx of ix.innerInstructions) {
      if (innerIx.name === 'transfer') {
        const transferData = innerIx.data as SplTokenTransferIxData;

        // Add token delta to total token delta
        const baseAmount = tokenTotals.get(transferData.mint) ?? new BN(0);
        const deltaAmount = (transferData.destinationOwner === wallet().publicKey.toBase58())
          ? transferData.amount
          : transferData.amount.neg();
        tokenTotals.set(transferData.mint, baseAmount.add(deltaAmount));

        // Add token delta to total USD delta
        const token = await getToken(transferData.mint);
        const tokenPrice = await getTokenPrice(token);
        usd += toNum(toUSD(deltaAmount, tokenPrice, token?.mint.decimals));
      }
    }
  }

  return { tokenTotals, usd };
}

export type * from './transaction-query.interfaces';
