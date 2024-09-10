import { Wallet } from '@coral-xyz/anchor';
import { BlockhashWithExpiryBlockHeight, Commitment, SimulateTransactionConfig as NativeSimulateTransactionConfig, SendOptions, Signer } from '@solana/web3.js';

/**
 * Configuration for confirming a transaction.
 */
export interface ConfirmTransactionConfig {

  /**
   * The {@link BlockhashWithExpiryBlockHeight} that was used to generate the recent/latest blockhash timestamp
   * for the transaction that is to be confirmed.
   *
   * If not provided, the latest blockhash is used.
   */
  blockhashWithExpiry?: BlockhashWithExpiryBlockHeight;

  /**
   * The {@link Commitment} level to use when verifying the transaction.
   *
   * @default env.COMMITMENT_DEFAULT
   */
  commitment?: Commitment;

  /**
   * Debug data to log when confirming the transaction.
   */
  debugData?: unknown;

}

/**
 * Configuration for sending a transaction.
 */
export interface SendTransactionConfig extends SendOptions {

  /**
   * Debug data to log when sending the transaction.
   */
  debugData?: unknown;

}

/**
 * Configuration for signing a transaction.
 */
export interface SignTransactionConfig {

  /**
   * Debug data to log when signing the transaction.
   */
  debugData?: unknown;

  /**
   * The payer {@link Wallet} to use when signing the transaction.
   *
   * @default wallet()
   */
  payerWallet?: Wallet;

  /**
   * The {@link Signer}s to use when signing the transaction.
   */
  signers?: readonly Signer[];

}

/**
 * Configuration for simulating a transaction.
 */
export interface SimulateTransactionConfig extends NativeSimulateTransactionConfig {

  /**
   * Debug data to log when simulating the transaction.
   */
  debugData?: unknown;

}

/**
 * The action performed on a transaction.
 */
export type TransactionAction = 'confirm' | 'send' | 'simulate';

/**
 * A transaction error that may occur when simulating or sending a {@link Transaction} or {@link VersionedTransaction}.
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
