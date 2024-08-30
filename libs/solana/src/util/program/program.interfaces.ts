import type { Address, Instruction } from '@coral-xyz/anchor';
import type { Null } from '@npc/core';
import type { AccountMeta, ConfirmedTransactionMeta, TransactionSignature, VersionedMessage } from '@solana/web3.js';
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
 * Error information pertaining to `IDL` errors thrown by `Anchor` or a `Smart Contract`.
 */
export interface ProgramErrorInfo {

  /**
   * The error code.
   *
   * `< 6000` -> `Anchor`.
   *
   * `>= 6000` -> `Smart Contracts`.
   */
  code: number;

  /**
   * The error message.
   */
  msg?: string;

  /**
   * The error name.
   */
  name: string;

}

/**
 * The decoded data of a token transfer instruction.
 */
export interface TokenTransfer {

  /**
   * The amount of tokens in the transfer.
   */
  amount: BN;

  /**
   * The keys of the transfer.
   */
  keys: {

    /**
     * The destination token account of the transfer.
     */
    destination: AccountMeta;

    /**
     * The owner of the destination token account.
     */
    destinationOwner: string;

    /**
     * The owner or authority of the transfer.
     */
    owner: AccountMeta;

    /**
     * The source token account of the transfer.
     */
    source: AccountMeta;

    /**
     * The owner of the source token account.
     */
    sourceOwner: string;

    /**
     * The mint of the transfer token.
     */
    mint: string;

  };

}

/**
 * The decoded data of a temporary token account.
 */
export interface TempTokenAccount {

  /**
   * The {@link AccountMeta} to initialize.
   */
  account: AccountMeta;

  /**
   * The mint of the {@link AccountMeta}.
   */
  mint: AccountMeta;

  /**
   * The owner of the {@link AccountMeta}.
   */
  owner: AccountMeta;

}
