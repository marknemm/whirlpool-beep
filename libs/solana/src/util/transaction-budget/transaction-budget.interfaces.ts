import { TransactionInstruction } from '@solana/web3.js';

/**
 * A compute budget for a transaction.
 */
export interface ComputeBudget {

  /**
   * The `CU` (compute units) limit.
   */
  computeUnitLimit?: number;

  /**
   * The compute budget {@link TransactionInstruction}s.
   */
  instructions: TransactionInstruction[];

  /**
   * The {@link TransactionPriority} used to generate the priority fee.
   */
  priority: TransactionPriority;

  /**
   * The total priority fee to pay for the transaction in lamports.
   */
  priorityFeeLamports: number;

}

/**
 * Compute budget options for a transaction.
 */
export type ComputeBudgetOptions = TransactionPriority
                                 | (Omit<ComputeBudget, 'instructions'> & { priority?: TransactionPriority });

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
   * Minimum urgency priority fee in micro lamports per compute unit (CU).
   */
  min: number;

  /**
   * Low urgency priority fee in micro lamports per compute unit (CU).
   */
  low: number;

  /**
   * Medium urgency priority fee in micro lamports per compute unit (CU).
   */
  medium: number;

  /**
   * High urgency priority fee in micro lamports per compute unit (CU).
   */
  high: number;

  /**
   * Very high urgency priority fee in micro lamports per compute unit (CU).
   */
  veryHigh: number;

  /**
   * Maximum urgency priority fee in micro lamports per compute unit (CU).
   */
  unsafeMax: number;

}

/**
 * The priority of a transaction, which dictates the priority fee to use.
 */
export type TransactionPriority = keyof PriorityFeeEstimate;
