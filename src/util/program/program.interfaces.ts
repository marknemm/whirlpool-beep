import type BN from 'bn.js';

/**
 * The decoded data of a SPL token transfer instruction.
 */
export interface SplTokenTransferIxData {

  /**
   * The amount of tokens in the transfer.
   */
  amount: BN;

  /**
   * The authority of the transfer.
   */
  authority: string;

  /**
   * The destination token account of the transfer.
   */
  destination: string;

  /**
   * The owner of the destination token account.
   */
  destinationOwner: string;

  /**
   * The source token account of the transfer.
   */
  source: string;

  /**
   * The owner of the source token account.
   */
  sourceOwner: string;

  /**
   * The mint of the transfer token.
   */
  mint: string;

}

/**
 * The decoded data of a temporary token account.
 */
export interface TempTokenAccount {

  /**
   * The account to initialize.
   */
  account: string;

  /**
   * The mint of the account.
   */
  mint: string;

  /**
   * The owner of the account.
   */
  owner: string;

}
