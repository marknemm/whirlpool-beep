import type { TransactionPriority } from '@/util/transaction-budget/transaction-budget.interfaces';
import type { BuildOptions } from '@orca-so/common-sdk';
import type { Commitment, SendOptions } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * Options for building a transaction.
 */
export type TransactionBuildOptions = Partial<BuildOptions> & {

  /**
   * The priority to use for the transaction.
   *
   * @default env.PRIORITY_LEVEL_DEFAULT
   */
  priority?: TransactionPriority;

}

/**
 * Metadata for a transaction.
 */
export interface TransactionMetadata {

  /**
   * The description of the operation being performed.
   */
  description?: string;

  /**
   * The name of the operation being performed.
   */
  name: string;

}

/**
 * Options for sending a transaction.
 */
export type TransactionSendOptions = Partial<SendOptions> & {

  /**
   * Wait for the sent transaction to be confirmed up to this level.
   *
   * @default 'finalized'
   */
  commitment?: Commitment;

}

/**
 * Summary of a generic transaction.
 */
export interface TransactionSummary {

  /**
   * The fee paid for the transaction in lamports.
   */
  fee: number;

  /**
   * The signature of the transaction.
   */
  signature: string;

  /**
   * The deltas for each token in the transaction.
   */
  tokens: Map<string, BN>;

  /**
   * The total delta of the transaction in USD.
   */
  usd: number;

}

export type * from '@/util/transaction-budget/transaction-budget.interfaces';
