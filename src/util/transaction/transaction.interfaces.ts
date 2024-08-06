import type { TransactionPriority } from '@/util/transaction-budget/transaction-budget.interfaces';
import type { Instruction } from '@coral-xyz/anchor';
import type { BuildOptions } from '@orca-so/common-sdk';
import type { Commitment, SendOptions } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * A fully decoded transaction instruction.
 */
export interface DecodedTransactionIx extends Instruction {

  /**
   * The inner instructions of the transaction.
   */
  innerInstructions: Instruction[];

  /**
   * The name of the program that the instruction belongs to.
   */
  programName: string;

}

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
 * A transaction error.
 */
export interface TransactionError {

  /**
   * The instruction error.
   */
  InstructionError: [
    number,
    {
      Custom: number;
    }
  ]
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
export interface TransactionSendOptions {

  /**
   * Maximum number of times for the RPC node to retry sending the transaction to the leader.
   *
   * @default 3
   */
  maxRetries?: number;

  /**
   * The minimum slot that the request can be evaluated at.
   */
  minContextSlot?: number;

  /**
   * The preflight {@link Commitment} level.
   *
   * @default 'confirmed'
   */
  preflightCommitment?: Commitment;

  /**
   * Whether to skip the preflight check.
   *
   * @default false
   */
  skipPreflight?: boolean;

  /**
   * Wait for the sent transaction to be confirmed up to this level.
   *
   * @default 'confirmed'
   */
  verifyCommitment?: Commitment;

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
   * The decoded instructions of the transaction.
   */
  decodedIxs: DecodedTransactionIx[];

  /**
   * The total delta of the transaction in USD.
   */
  usd: number;

}

/**
 * Transfer totals for a transaction.
 */
export interface TransferTotals {

  /**
   * The total token transfer amount deltas.
   */
  tokenTotals: Map<string, BN>;

  /**
   * The total USD delta.
   */
  usd: number;

}

export type * from '@/util/transaction-budget/transaction-budget.interfaces';
