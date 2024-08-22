import type { Wallet } from '@coral-xyz/anchor';
import type { Null } from '@npc/core';
import type { ComputeBudget, ComputeBudgetOptions } from '@npc/solana/util/transaction-budget/transaction-budget.interfaces.js';
import type { AddressLookupTableAccount, BlockhashWithExpiryBlockHeight, Commitment, SendOptions, Signer, SimulateTransactionConfig, Transaction, TransactionInstruction, TransactionSignature, VersionedTransaction } from '@solana/web3.js';
import type { Required } from 'utility-types';
import type TransactionContext from './transaction-context.js';

/**
 * Options for building a transaction.
 */
export interface BuildTransactionOptions {

  /**
   * The {@link AddressLookupTableAccount}s to use for the transaction.
   */
  addressLookupTableAccounts?: AddressLookupTableAccount[];

  /**
   * The {@link Commitment} level to use when generating the recent blockhash timestamp for the transaction.
   *
   * @default env.COMMITMENT_DEFAULT
   */
  commitment?: Commitment;

  /**
   * Compute budget options for the transaction.
   *
   * If set explicitly to `null`, then the compute budget is not generated.
   *
   * @default { priority: env.PRIORITY_LEVEL_DEFAULT }
   */
  computeBudget?: ComputeBudgetOptions;

  /**
   * The {@link SignTransactionOptions} to use when signing the transaction.
   *
   * If not provided, the transaction is signed using the default {@link SignTransactionOptions}.
   */
  signOpts?: SignTransactionOptions;

  /**
   * Whether to skip signing the transaction.
   *
   * @default false
   */
  skipSign?: boolean;

  /**
   * The version of the transaction to build.
   *
   * @default 0
   */
  version?: number | 'legacy';

  /**
   * The {@link Wallet} to use as the payer.
   *
   * If not provided, defaults to the global {@link Wallet}.
   */
  wallet?: Wallet;

}

/**
 * A build transaction history record.
 */
export interface BuildTransactionRecord {

  /**
   * The {@link BlockhashWithExpiryBlockHeight} used for the built transaction's latest/recent blockhash timestamp.
   */
  blockhashWithExpiry: BlockhashWithExpiryBlockHeight;

  /**
   * The {@link BuildTransactionOptions} used to build the transaction.
   */
  buildOpts: BuildTransactionOptions;

  /**
   * The {@link ComputeBudget} of the transaction.
   */
  computeBudget: ComputeBudget;

  /**
   * The {@link InstructionMetadata}.
   */
  metadata: readonly InstructionMetadata[];

  /**
   * Whether the transaction was signed.
   */
  signed: boolean;

  /**
   * Whether the transaction was simulated.
   */
  simulated: boolean;

  /**
   * The timestamp of when the transaction was built.
   */
  timestamp: number;

  /**
   * The built {@link Transaction} or {@link VersionedTransaction}.
   */
  tx: Transaction | VersionedTransaction;

  /**
   * The {@link Wallet} used as the payer.
   */
  wallet: Wallet;

}

/**
 * Options for confirming a transaction.
 */
export interface ConfirmTransactionOptions {

  /**
   * The {@link BlockhashWithExpiryBlockHeight} that was used to generate the recent/latest blockhash timestamp
   * for the transaction that is to be confirmed.
   *
   * If not provided, the latest blockhash is used.
   */
  blockhashWithExpiry?: BlockhashWithExpiryBlockHeight;

  /**
   * The {@link Commitment} level to use when verifying the transaction.
   *
   * @default env.COMMITMENT_DEFAULT
   */
  commitment?: Commitment;

}

/**
 * Instruction data for a transaction.
 */
export interface InstructionData extends InstructionMetadata {

  /**
   * The cleanup {@link TransactionInstruction}s to execute after all {@link instructions} are executed.
   */
  cleanupInstructions?: TransactionInstruction[];

  /**
   * The {@link TransactionInstruction}(s) to execute.
   */
  instructions: readonly TransactionInstruction[];

  /**
   * The {@link Signer}(s) used to sign the {@link instructions}.
   */
  signers?: readonly Signer[];

}

/**
 * Options for sending a transaction.
 */
export interface SendTransactionOptions extends SendOptions {

  /**
   * The {@link BuildTransactionOptions} to use when building the transaction that is to be sent.
   *
   * If not provided, the transaction is built using the default {@link BuildTransactionOptions}.
   *
   * If {@link useLatestBuild} is set to `true`, this is ignored.
   */
  buildOpts?: BuildTransactionOptions;

  /**
   * The {@link Commitment} to use when confirming the transaction.
   *
   * @default env.COMMITMENT_DEFAULT
   */
  confirmCommitment?: Commitment;

  /**
   * Whether to skip transaction confirmation.
   *
   * @default false
   */
  skipConfirm?: boolean;

  /**
   * Whether to skip performing a new build and send the latest built {@link BuildTransactionRecord}.
   * If the latest build does not exist, a new build is performed.
   *
   * @default false
   */
  useLatestBuild?: boolean;

}

/**
 * A send transaction history record.
 */
export interface SendTransactionRecord {

  /**
   * {@link BuildTransactionRecord} used to build the transaction that was sent.
   */
  buildRecord?: BuildTransactionRecord;

  /**
   * Whether the transaction was confirmed.
   */
  confirmed: boolean;

  /**
   * The error that occurred when sending the transaction.
   */
  err?: unknown;

  /**
   * The {@link SendTransactionOptions} used to send the transaction.
   */
  sendOpts: SendTransactionOptions;

  /**
   * The signature of the sent transaction.
   *
   * If the transaction encountered an error upon being sent, this is `''`.
   */
  signature?: TransactionSignature;

}

/**
 * The result of sending a transaction.
 */
export interface SendTransactionResult extends Omit<Required<SendTransactionRecord>, 'err'> {

  /**
   * The {@link SendTransactionRecord} history including the final successful send result record.
   */
  sendHistory: readonly SendTransactionRecord[];

}

/**
 * Options for signing a transaction.
 */
export interface SignTransactionOptions {

  /**
   * Whether to retain previous signatures.
   *
   * @default false
   */
  retainPreviousSignatures?: boolean;

}

export interface SimulateTransactionOptions extends SimulateTransactionConfig {

  /**
   * The {@link BuildTransactionOptions} to use when building the transaction that is to be simulated.
   *
   * If not provided, the transaction is built using the default {@link BuildTransactionOptions}.
   */
  buildOpts?: BuildTransactionOptions;

  /**
   * Whether to skip performing a new build and simulate the latest built {@link BuildTransactionRecord}.
   * If the latest build does not exist, a new build is performed.
   *
   * @default false
   */
  useLatestBuild?: boolean;

}

/**
 * Custom options for a {@link TransactionContext} instance.
 */
export interface TransactionCtxOptions {

  /**
   * The {@link BuildTransactionOptions} to use when building a transaction.
   */
  buildOpts?: BuildTransactionOptions;

  /**
   * The {@link ConfirmTransactionOptions} to use when confirming a transaction.
   */
  confirmOpts?: ConfirmTransactionOptions;

  /**
   * The {@link SendTransactionOptions} to use when sending a transaction.
   */
  sendOpts?: SendTransactionOptions;

}

/**
 * Debug data for an instruction, which is in a format that is easily loggable.
 */
export interface InstructionDebugData {

  /**
   * The description of the operation being performed.
   */
  description?: string;

  /**
   * The name of the operation being performed.
   */
  name: string;

  /**
   * Any additional debug data.
   */
  [key: string]: boolean | number | string | Null | boolean[] | number[] | string[] | Null[];

}

export interface InstructionMetadata {

  /**
   * The debug data for the transaction. Should be in a format that is easily loggable.
   */
  debugData: InstructionDebugData;

}

export type * from '@npc/solana/util/transaction-budget/transaction-budget.interfaces.js';
