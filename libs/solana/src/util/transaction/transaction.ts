import { type Wallet } from '@coral-xyz/anchor';
import type { Null } from '@npc/core';
import { info, timeout } from '@npc/core';
import env from '@npc/solana/util/env/env';
import rpc from '@npc/solana/util/rpc/rpc';
import wallet from '@npc/solana/util/wallet/wallet';
import { TransactionMessage, VersionedTransaction, type BlockhashWithExpiryBlockHeight, type Commitment, type SendOptions, type Signer, type SimulatedTransactionResponse, type SimulateTransactionConfig, type Transaction, type TransactionInstruction, type TransactionSignature } from '@solana/web3.js';
import type { TransactionAction, TransactionError } from './transaction.interfaces';

/**
 * Confirms a transaction.
 *
 * @param signature The {@link TransactionSignature} of the transaction to confirm.
 * @param commitment The {@link Commitment} level to use when verifying the transaction.
 * If not provided, {@link env.COMMITMENT_DEFAULT} is used.
 * @param blockhashWithExpiry The {@link BlockhashWithExpiryBlockHeight} that was used to generate
 * the recent/latest blockhash timestamp for the transaction that is to be confirmed.
 * If not provided, the latest blockhash is used.
 * @returns A {@link Promise} that resolves to the confirmed {@link TransactionSignature}.
 * @throws An {@link Error} if the transaction is rejected.
 */
export async function confirmTx(
  signature: TransactionSignature,
  commitment: Commitment = env.COMMITMENT_DEFAULT,
  blockhashWithExpiry?: BlockhashWithExpiryBlockHeight
): Promise<TransactionSignature> {
  // Wait for the transaction to be confirmed as included in a block with commitment 'processed'.
  blockhashWithExpiry ??= await rpc().getLatestBlockhash();
  let confirmResponse = await rpc().confirmTransaction({ signature, ...blockhashWithExpiry }, 'processed');

  // Throw error if transaction was rejected.
  if (confirmResponse.value.err) {
    throw formatTxError(confirmResponse.value.err, 'confirm');
  }

  info('Transaction has been processed:', signature);
  await timeout(3000);

  // If a higher commitment level is requested, confirm the transaction with that level using retries.
  if (['confirmed', 'finalized'].indexOf(commitment)) {
    blockhashWithExpiry = await rpc().getLatestBlockhash();
    confirmResponse = await rpc().confirmTransaction({ signature, ...blockhashWithExpiry }, commitment);
    if (confirmResponse.value.err) {
      throw formatTxError(confirmResponse.value.err, 'confirm');
    }
    info(`Transaction has been ${commitment}:`, signature);
  }

  return signature;
}

/**
 * Gets the {@link TransactionInstruction}s from a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction}, {@link VersionedTransaction}, or `base64` encoded string to get the instructions from.
 * @returns The {@link TransactionInstruction}s.
 */
export function getTxInstructions(tx: Transaction | VersionedTransaction | string | Null): TransactionInstruction[] {
  if (!tx) return [];

  if (typeof tx === 'string') {
    tx = toVersionedTx(tx);
  }

  return (tx instanceof VersionedTransaction)
    ? TransactionMessage.decompile(tx.message).instructions
    : tx.instructions;
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
 * @param opts The {@link SendOptions} to use for sending the transaction.
 * @returns A {@link Promise} that resolves to the {@link TransactionSignature} of the sent transaction.
 */
export async function sendTx(
  tx: Transaction | VersionedTransaction,
  opts: SendOptions = {}
): Promise<TransactionSignature> {
  opts = {
    maxRetries: env.RPC_MAX_RETRIES,
    preflightCommitment: env.COMMITMENT_DEFAULT,
    ...opts
  };

  return rpc().sendRawTransaction(tx.serialize(), opts);
}

/**
 * Signs a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction} or {@link VersionedTransaction} to sign.
 * @param signers The {@link Signer}s to sign the transaction with.
 * @param payerWallet The {@link Wallet} to sign the transaction with.
 * @returns A {@link Promise} that resolves to the signed {@link Transaction} or {@link VersionedTransaction}.
 */
export async function signTx<T extends Transaction | VersionedTransaction>(
  tx: T,
  signers: readonly Signer[] = [],
  payerWallet: Wallet = wallet()
): Promise<T> {
  await payerWallet.signTransaction(tx);

  (tx instanceof VersionedTransaction)
    ? tx.sign([...signers])
    : signers.forEach((signer) => tx.partialSign(signer));

  return tx;
}

/**
 * Simulates a {@link Transaction} or {@link VersionedTransaction}.
 *
 * @param tx The {@link Transaction} or {@link VersionedTransaction} to simulate.
 * @param opts The {@link SimulateTransactionConfig} to use for simulating the transaction.
 * @returns A {@link Promise} that resolves to the {@link SimulatedTransactionResponse}.
 * @throws If the simulation fails.
 */
export async function simulateTx(
  tx: Transaction | VersionedTransaction,
  opts: SimulateTransactionConfig = {}
): Promise<SimulatedTransactionResponse> {
  const versionedTx = await toVersionedTx(tx);

  const response = await rpc().simulateTransaction(versionedTx, opts);
  if (response.value.err) {
    throw formatTxError(response.value.err, 'simulate', response.value.logs);
  }

  return response.value;
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

export type * from './transaction.interfaces';
