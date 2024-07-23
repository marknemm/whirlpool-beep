import type { BuildOptions } from '@orca-so/common-sdk';
import type { Commitment, SendOptions } from '@solana/web3.js';
import type BN from 'bn.js';

export interface ComputeBudget {

  /**
   * The limit of the compute budget measured in CU (compute units).
   */
  computeBudgetLimit: number | undefined;

  /**
   * The priority fee to pay for the transaction.
   */
  priorityFeeLamports: number;

  /**
   * The type of compute budget to use.
   */
  type: 'fixed';

}

/**
 * A priority fee estimate for a transaction.
 */
export interface PriorityFeeEstimateResponse {

  /**
   * The result of the request.
   */
  result: {

    /**
     * Estimated priority fees mapped to levels of urgency.
     */
    priorityFeeLevels: PriorityFeeEstimate;

  };

}

/**
 * Priority fee estimates for a transaction mapped to levels of urgency.
 */
export interface PriorityFeeEstimate {

  /**
   * Minimum urgency priority fee.
   */
  min: number;

  /**
   * Low urgency priority fee.
   */
  low: number;

  /**
   * Medium urgency priority fee.
   */
  medium: number;

  /**
   * High urgency priority fee.
   */
  high: number;

  /**
   * Very high urgency priority fee.
   */
  veryHigh: number;

  /**
   * Maximum urgency priority fee.
   */
  unsafeMax: number;

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
 * The priority of a transaction, which dictates the priority fee to use.
 */
export type TransactionPriority = keyof PriorityFeeEstimate;

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
