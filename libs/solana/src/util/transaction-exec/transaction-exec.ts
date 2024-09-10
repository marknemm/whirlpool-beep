import { debug, Null, timeout } from '@npc/core';
import env from '@npc/solana/util/env/env';
import { decodeTransaction } from '@npc/solana/util/program/program';
import rpc from '@npc/solana/util/rpc/rpc';
import wallet from '@npc/solana/util/wallet/wallet';
import { TransactionMessage, VersionedTransaction, type SimulatedTransactionResponse, type Transaction, type TransactionInstruction, type TransactionSignature } from '@solana/web3.js';
import { green } from 'colors';
import type { ConfirmTransactionConfig, SendTransactionConfig, SignTransactionConfig, SimulateTransactionConfig, TransactionAction, TransactionError } from './transaction-exec.interfaces';

/**
 * Confirms a transaction.
 *
 * @param signature The {@link TransactionSignature} of the transaction to confirm.
 * @param config The {@link ConfirmTransactionConfig} to use for confirming the transaction.
 * @returns A {@link Promise} that resolves to the confirmed {@link TransactionSignature}.
 * @throws An {@link Error} if the transaction is rejected.
 */
export async function confirmTx(
  signature: TransactionSignature,
  config: ConfirmTransactionConfig = {}
): Promise<TransactionSignature> {
  const {
    commitment = env.COMMITMENT_DEFAULT,
    debugData,
  } = config;

  debug(`Confirming Tx ( Commitment: ${green(commitment)} ):`, signature);
  if (debugData) debug(debugData);

  // Wait for the transaction to be confirmed as included in a block with commitment 'processed'.
  let blockhashWithExpiry = config.blockhashWithExpiry ?? await rpc().getLatestBlockhash();
  let confirmResponse = await rpc().confirmTransaction({ signature, ...blockhashWithExpiry }, 'processed');

  // Throw error if transaction was rejected.
  if (confirmResponse.value.err) {
    throw formatTxError(confirmResponse.value.err, 'confirm');
  }

  debug('Transaction has been processed:', signature);
  if (debugData) debug(debugData);
  await timeout(3000);

  // If a higher commitment level is requested, confirm the transaction with that level using retries.
  if (['confirmed', 'finalized'].indexOf(commitment)) {
    blockhashWithExpiry = await rpc().getLatestBlockhash();
    confirmResponse = await rpc().confirmTransaction({ signature, ...blockhashWithExpiry }, commitment);
    if (confirmResponse.value.err) {
      throw formatTxError(confirmResponse.value.err, 'confirm');
    }
    debug(`Transaction has been ${commitment}:`, signature);
    if (debugData) debug(debugData);
  }

  return signature;
}

/**
 * Processes a raw transaction error.
 *
 * @param err The raw transaction error to process.
 * @param action The {@link TransactionAction} that produced the error.
 * @param logs The transaction logs associated with the error.
 * @returns The processed and throwable {@link Error}.
 */
export function formatTxError(err: unknown, action?: TransactionAction, logs?: string[] | null): Error {
  const mainMsg = `Transaction${action ? ` ${action}` : ''} failed`;
  const logMsg = logs
    ? `\nLogs:\n[\n\t"${logs.join('",\n\t"')}"\n]`
    : '';

  const txErr = err as TransactionError;
  if (txErr.InstructionError) {
    return new Error(
        `${mainMsg}: instruction index ${txErr.InstructionError[0]}, `
      + `custom program error ${txErr.InstructionError[1].Custom}`
    );
  }

  try {
    return new Error(
      `${mainMsg}: ${JSON.stringify(txErr, undefined, 2)}${logMsg}`
    );
  } catch (e) { // JSON.stringify can throw an error, don't want it to cause actual error to be lost.
    return new Error(`${mainMsg}: ${err}${logMsg}`);
  }
}

/**
 * Sends a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction} or {@link VersionedTransaction} to send.
 * @param opts The {@link SendTransactionConfig} to use for sending the transaction.
 * @returns A {@link Promise} that resolves to the {@link TransactionSignature} of the sent transaction.
 */
export async function sendTx(
  tx: Transaction | VersionedTransaction,
  opts: SendTransactionConfig = {}
): Promise<TransactionSignature> {
  opts = {
    maxRetries: env.RPC_MAX_RETRIES,
    preflightCommitment: env.COMMITMENT_DEFAULT,
    ...opts
  };

  const decodedIxs = await decodeTransaction(tx);
  const { debugData } = opts;

  debug('Sending Tx:', { decodedIxs, debugData });
  const signature = await rpc().sendRawTransaction(tx.serialize(), opts);

  debug('Sent Tx:', { decodedIxs, debugData, signature });
  return signature;
}

/**
 * Signs a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction} or {@link VersionedTransaction} to sign.
 * @param config The {@link SignTransactionConfig} to use for signing the transaction.
 * @returns A {@link Promise} that resolves to the signed {@link Transaction} or {@link VersionedTransaction}.
 */
export async function signTx<T extends Transaction | VersionedTransaction>(
  tx: T,
  config: SignTransactionConfig = {}
): Promise<T> {
  const {
    payerWallet = wallet(),
    signers = [],
  } = config;

  await payerWallet.signTransaction(tx);

  (tx instanceof VersionedTransaction)
    ? tx.sign([...signers])
    : signers.forEach((signer) => tx.partialSign(signer));

  debug('Tx signed:', {
    debugData: config.debugData,
    payer: payerWallet.publicKey.toBase58(),
    signers: signers.map((signer) => signer.publicKey.toBase58()),
  });

  return tx;
}

/**
 * Simulates a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction} or {@link VersionedTransaction} to simulate.
 * @param config The {@link SimulateTransactionConfig} to use for simulating the transaction.
 * @returns A {@link Promise} that resolves to the {@link SimulatedTransactionResponse}.
 * @throws If the simulation fails.
 */
export async function simulateTx(
  tx: Transaction | VersionedTransaction,
  config: SimulateTransactionConfig = {}
): Promise<SimulatedTransactionResponse> {
  const { debugData, replaceRecentBlockhash, sigVerify } = config;
  const decodedIxs = await decodeTransaction(tx);

  const versionedTx = await toVersionedTx(tx);

  debug('Simulating Tx:', {
    decodedIxs,
    debugData,
    replaceRecentBlockhash,
    sigVerify,
  });

  const response = await rpc().simulateTransaction(versionedTx, config);
  if (response.value.err) {
    throw formatTxError(response.value.err, 'simulate', response.value.logs);
  }

  debug('Tx simulated:', {
    decodedIxs,
    debugData,
    unitsConsumed: response.value.unitsConsumed,
    logs: response.value.logs,
  });

  return response.value;
}

/**
 * Gets the {@link TransactionInstruction}s from a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction}, {@link VersionedTransaction}, or `base64` encoded string to get the instructions from.
 * @returns The {@link TransactionInstruction}s.
 */
export function toTxInstructions(tx: Transaction | VersionedTransaction | string | Null): TransactionInstruction[] {
  if (!tx) return [];

  if (typeof tx === 'string') {
    tx = toVersionedTx(tx);
  }

  return (tx instanceof VersionedTransaction)
    ? TransactionMessage.decompile(tx.message).instructions
    : tx.instructions;
}

/**
 * Converts a {@link Transaction} to a {@link VersionedTransaction}.
 *
 * `Note`: Must re-sign the transaction after conversion.
 *
 * @param tx The {@link Transaction} or `base64` encoded transaction string to convert.
 * @returns A {@link Promise} that resolves to the {@link VersionedTransaction}.
 * If the input is already a {@link VersionedTransaction}, it is returned as is.
 */
export function toVersionedTx(tx: Transaction | VersionedTransaction | string): VersionedTransaction {
  if (tx instanceof VersionedTransaction) return tx;

  if (typeof tx === 'string') {
    return VersionedTransaction.deserialize(Buffer.from(tx, 'base64'));
  }

  return new VersionedTransaction(
    new TransactionMessage({
      instructions: tx.instructions,
      payerKey: tx.feePayer ?? wallet().publicKey,
      recentBlockhash: tx.recentBlockhash!,
    }).compileToV0Message()
  );
}

export type * from './transaction-exec.interfaces';
