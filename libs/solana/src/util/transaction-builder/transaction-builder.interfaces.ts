import type { Wallet } from '@coral-xyz/anchor';
import type { ComputeBudget, ComputeBudgetOptions } from '@npc/solana/util/compute-budget/compute-budget';
import type { AddressLookupTableAccount, BlockhashWithExpiryBlockHeight, Commitment, Signer, Transaction, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';

/**
 * A transaction instruction set containing data for an atomic set of {@link TransactionInstruction}s.
 */
export interface InstructionSet {

  /**
   * The cleanup {@link TransactionInstruction}s to be run at the end of the transaction.
   */
  cleanupInstructions: readonly TransactionInstruction[];

  /**
   * The {@link TransactionInstruction}s to be run in the transaction.
   */
  instructions: readonly TransactionInstruction[];

  /**
   * The {@link Signer}s of the transaction.
   */
  signers: readonly Signer[];

}

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
   * Debug data to log when building the transaction.
   */
  debugData?: unknown;

  /**
   * A weight used to augment the priority fee set within the built transaction.
   * Typically set as the number of retries for sending the built transaction.
   *
   * @default 0
   */
  priorityFeeAugment?: number;

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
