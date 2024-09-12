import type { BuildTransactionOptions, BuildTransactionRecord } from '@npc/solana/util/transaction-builder/transaction-builder';
import type { SendTransactionConfig, SimulateTransactionConfig } from '@npc/solana/util/transaction-exec/transaction-exec.interfaces';
import type { BlockhashWithExpiryBlockHeight, Commitment, TransactionSignature } from '@solana/web3.js';
import type TransactionContext from './transaction-context';

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
 * Options for building and sending a transaction.
 *
 * @augments SendTransactionOptions
 */
export interface SendTransactionOptions extends SendTransactionConfig {

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
   * Whether to disable retrying the transaction upon failure.
   *
   * @default false
   */
  disableRetry?: boolean;

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
 * Options for building and simulating a transaction.
 *
 * @augments SimulateTransactionConfig
 */
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

export interface ResetTransactionContextOptions {

  /**
   * Whether to retain the build history.
   *
   * @default false
   */
  retainBuildHistory?: boolean;

  /**
   * Whether to retain the send history.
   *
   * @default false
   */
  retainSendHistory?: boolean;

}

/**
 * Custom options for a {@link TransactionContext} instance.
 */
export interface TransactionContextOptions {

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

export type * from '@npc/solana/util/transaction-builder/transaction-builder.interfaces';

