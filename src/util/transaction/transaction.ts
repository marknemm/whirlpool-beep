import { expBackoff } from '@/util/async/async';
import env from '@/util/env/env';
import { debug, info, warn } from '@/util/log/log';
import { toNum, toUSD } from '@/util/number-conversion/number-conversion';
import { decodeIx, type SplTokenTransferIxData, type TempTokenAccount } from '@/util/program/program';
import rpc from '@/util/rpc/rpc';
import { getToken, getTokenPrice } from '@/util/token/token';
import { genComputeBudget } from '@/util/transaction-budget/transaction-budget';
import wallet from '@/util/wallet/wallet';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { type Commitment, type ParsedTransactionWithMeta, type SendTransactionError, type VersionedTransactionResponse } from '@solana/web3.js';
import BN from 'bn.js';
import { green } from 'colors';
import type { DecodedTransactionIx, TransactionBuildOptions, TransactionError, TransactionMetadata, TransactionSendOptions, TransactionSummary, TransferTotals } from './transaction.interfaces';

const _txCache = new Map<string, ParsedTransactionWithMeta>();
const _txSummaryCache = new Map<string, TransactionSummary>();

/**
 * Executes a given transaction.
 *
 * @param tx The transaction to execute.
 * @param txMetadata Metadata pertaining to the transaction to execute. Used primarily for debugging / logging.
 * @param buildOpts The {@link TransactionBuildOptions} to use for building the transaction.
 * @param sendOpts The {@link TransactionSendOptions} to use for sending the transaction.
 * @returns A {@link Promise} that resolves to the signature of the executed transaction.
 * @throws An {@link Error} if the transaction execution fails.
 */
export async function executeTransaction<TMeta extends TransactionMetadata>(
  tx: TransactionBuilder,
  txMetadata: TMeta,
  buildOpts: TransactionBuildOptions = {},
  sendOpts: TransactionSendOptions = {},
): Promise<string> {
  buildOpts.computeBudgetOption ??= await genComputeBudget(tx, buildOpts);
  sendOpts.maxRetries ??= env.RPC_MAX_RETRIES;

  try {
    return await expBackoff(
      async (retry: number) => {
        // Retry with a new compute budget if the transaction expired
        if (retry > 0) {
          buildOpts.computeBudgetOption = await genComputeBudget(tx, buildOpts, retry);
        }

        info('Executing Tx:', {
          ...txMetadata,
          ...buildOpts.computeBudgetOption,
          retry,
        });

        const signature = await tx.buildAndExecute(buildOpts, sendOpts);
        await verifyTransaction(signature, txMetadata, sendOpts.verifyCommitment);

        info('Tx executed and verified:', {
          ...txMetadata,
          signature,
        });
        return signature;
      },
      {
        retryFilter: (result, err) =>
             !!(err as SendTransactionError)?.stack?.includes('TransactionExpiredBlockheightExceededError') // Blockhash 'too old' - tx wasn't processed in time.
          || !!(err as SendTransactionError)?.stack?.includes('Blockhash not found'),                       // Blockhash 'too new' - RPC node is behind or on minority fork.
      }
    );
  } catch (err) {
    warn('Tx execution failed:', txMetadata);
    throw err;
  }
}

/**
 * Verifies a blockchain transaction by waiting for it to be confirmed.
 *
 * @param signature The signature of the transaction to verify.
 * @param txMetadata Metadata pertaining to the transaction to verify.
 * @param commitment The commitment level to use for the verification. Defaults to `confirmed`.
 * @returns A {@link Promise} that resolves when the transaction is confirmed.
 * @throws An {@link Error} if the transaction cannot be confirmed.
 */
export async function verifyTransaction<TMeta extends TransactionMetadata>(
  signature: string,
  txMetadata: TMeta,
  commitment: Commitment = 'confirmed'
): Promise<void> {
  debug(`Verifying Tx ( Commitment: ${green(commitment)} ):`, {
    ...txMetadata,
    signature
  });

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  const confirmResponse = await rpc().confirmTransaction({ signature, ...latestBlockhash }, commitment);

  if (confirmResponse.value.err) {
    const txErr = confirmResponse.value.err as TransactionError;
    if (txErr.InstructionError) {
      throw new Error(`Error in transaction: instruction index ${txErr.InstructionError[0]}, `
        + `custom program error ${txErr.InstructionError[1].Custom}`);
    }

    throw new Error(`Error in transaction: ${JSON.stringify(txErr)}`);
  }
}

/**
 * Gets a transaction by its {@link signature}.
 *
 * @param signature The signature of the transaction to get.
 * @returns A {@link Promise} that resolves to the {@link VersionedTransactionResponse};
 * `undefined` if the transaction cannot be retrieved.
 */
export async function getTransaction(
  signature: string,
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
  signature: string,
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

export type * from './transaction.interfaces';
