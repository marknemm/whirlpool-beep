import type { DecodedTransactionIx, TokenTransfer } from '@npc/solana/util/program/program';
import type { ComputeBudget, SendTransactionResult } from '@npc/solana/util/transaction-context/transaction-context';
import type { TransactionSignature } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * Summary of a generic transaction.
 */
export interface TxSummary {

  /**
   * The time when the transaction was processed.
   */
  blockTime: Date;

  /**
   * The {@link ComputeBudget} for the transaction.
   */
  computeBudget: Partial<ComputeBudget>;

  /**
   * The number of compute units consumed by the transaction.
   */
  computeUnitsConsumed: number;

  /**
   * The {@link DecodedTransactionIx}s of the transaction.
   */
  decodedIxs: DecodedTransactionIx[];

  /**
   * The total fee paid for the transaction in SOL.
   */
  fee: number;

  /**
   * The total priority fee paid for the transaction in SOL.
   */
  priorityFee: number;

  /**
   * The {@link SendTransactionResult} for the transaction.
   */
  sendResult?: SendTransactionResult;

  /**
   * The {@link TransactionSignature} in base-58 format.
   */
  signature: TransactionSignature;

  /**
   * The size of the serialized transaction in bytes.
   */
  size: number;

  /**
   * The deltas for each token in the transaction.
   */
  tokens: Map<string, BN>;

  /**
   * The {@link TokenTransfer}s of the transaction.
   */
  transfers: TokenTransfer[];

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
