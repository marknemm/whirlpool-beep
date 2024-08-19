import type { Null } from '@/interfaces/nullable.interfaces';
import type { TokenTransfer } from '@/util/program/program';
import type { ComputeBudget, SendTransactionResult } from '@/util/transaction-context/transaction-context';
import type { Address, Instruction } from '@coral-xyz/anchor';
import type { ConfirmedTransactionMeta, TransactionSignature, VersionedMessage } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * Arguments for decoding a transaction.
 */
export interface DecodeTransactionArgs {

  /**
   * The read data of a {@link VersionedTransaction}.
   */
  transaction: { message: VersionedMessage, signatures: string[] };

  /**
   * The {@link ConfirmedTransactionMeta} of the transaction to decode.
   */
  meta?: ConfirmedTransactionMeta | Null;

  /**
   * The {@link TransactionSignature} of the transaction to decode.
   */
  signature: TransactionSignature;

}

/**
 * A fully decoded transaction instruction.
 */
export interface DecodedTransactionIx extends Instruction {

  /**
   * The inner {@link Instruction}s of the transaction.
   */
  innerInstructions: Omit<DecodedTransactionIx, 'innerInstructions'>[];

  /**
   * The {@link Address} of the program that handles the instruction.
   */
  programId: Address;

  /**
   * The name of the program that handles the instruction.
   */
  programName: string;

}

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
