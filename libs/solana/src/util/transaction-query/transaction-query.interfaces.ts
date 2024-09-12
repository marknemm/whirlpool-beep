import type { ComputeBudget } from '@npc/solana/util/compute-budget/compute-budget';
import type { DecodedTransactionIx, TokenTransfer } from '@npc/solana/util/program/program';
import type { InstructionSet } from '@npc/solana/util/transaction-context/transaction-context';
import type { TransactionSignature } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * Summary of a decoded transaction instruction.
 *
 * @augments DecodedTransactionIx
 */
export interface IxSummary extends DecodedTransactionIx {

  /**
   * The total transfer amount for each token in the instruction.
   */
  tokens: Map<string, BN>;

  /**
   * The token transfers of the instruction.
   */
  transfers: TokenTransfer[];

  /**
   * The total transfer amount of the instruction in USD.
   */
  usd: number;

}

/**
 * Summary of a Solana transaction.
 *
 * @template T The {@link InstructionSet} type for the transaction.
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
   * The total fee paid for the transaction in SOL.
   */
  fee: number;

  /**
   * The {@link IxSummary}s of the transaction.
   */
  instructions: IxSummary[];

  /**
   * The total priority fee paid for the transaction in SOL.
   */
  priorityFee: number;

  /**
   * The {@link TransactionSignature} in base-58 format.
   */
  signature: TransactionSignature;

  /**
   * The size of the serialized transaction in bytes.
   */
  size: number;

  /**
   * The total transfer amount for each token in the transaction.
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
  tokens: Map<string, BN>;

  /**
   * The total USD delta.
   */
  usd: number;

}
