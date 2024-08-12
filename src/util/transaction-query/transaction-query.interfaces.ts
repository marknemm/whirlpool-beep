import type { Instruction } from '@coral-xyz/anchor';
import type { TransactionSignature } from '@solana/web3.js';
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
  signature: TransactionSignature;

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
