import { expBackoff, warn } from '@npc/core';
import env from '@npc/solana/util/env/env';
import TransactionBuilder from '@npc/solana/util/transaction-builder/transaction-builder';
import { confirmTx, sendTx, simulateTx } from '@npc/solana/util/transaction-exec/transaction-exec';
import { getTxSummary, type TxSummary } from '@npc/solana/util/transaction-query/transaction-query';
import { type SendTransactionError, type SimulatedTransactionResponse, type SimulateTransactionConfig, type Transaction, type TransactionSignature, type VersionedTransaction } from '@solana/web3.js';
import type { BuildTransactionOptions, BuildTransactionRecord, ConfirmTransactionOptions, InstructionSet, ResetTransactionContextOptions, SendTransactionOptions, SendTransactionRecord, SimulateTransactionOptions, TransactionContextOptions } from './transaction-context.interfaces';

/**
 * A context for building, sending, confirming, and retrying {@link Transaction}s or {@link VersionedTransaction}s.
 */
export class TransactionContext extends TransactionBuilder {

  /**
   * The default {@link ConfirmTransactionOptions} to use for confirming a {@link Transaction} or {@link VersionedTransaction}.
   */
  static readonly DEFAULT_CONFIRM_TX_OPTS: ConfirmTransactionOptions = {
    commitment: env.COMMITMENT_DEFAULT,
  };

  /**
   * The default {@link SendTransactionOptions} to use for sending a {@link Transaction} or {@link VersionedTransaction}.
   */
  static readonly DEFAULT_SEND_TX_OPTS: SendTransactionOptions = {
    maxRetries: env.RPC_MAX_RETRIES,
    preflightCommitment: env.COMMITMENT_DEFAULT,
    skipPreflight: false,
  };

  readonly confirmOpts: ConfirmTransactionOptions;
  readonly sendOpts: SendTransactionOptions;

  #buildHistory: BuildTransactionRecord[] = [];
  #sendHistory: SendTransactionRecord[] = [];

  /**
   * Constructs a new {@link TransactionContext}.
   *
   * @param ctxOpts The {@link TransactionContextOptions} to use for the {@link TransactionContext} instance.
   */
  constructor(ctxOpts: TransactionContextOptions = {}) {
    super(ctxOpts.buildOpts);
    this.confirmOpts = ctxOpts.confirmOpts ?? {};
    this.sendOpts = ctxOpts.sendOpts ?? {};
  }

  /**
   * The {@link BuildTransactionRecord} history of the {@link TransactionContext}.
   */
  get buildHistory(): readonly BuildTransactionRecord[] {
    return this.#buildHistory;
  }

  /**
   * The latest {@link BuildTransactionRecord} of the {@link TransactionContext}.
   */
  get latestBuild(): BuildTransactionRecord | undefined {
    return this.buildHistory[this.buildHistory.length - 1];
  }

  /**
   * The latest {@link SendTransactionRecord} of the {@link TransactionContext}.
   */
  get latestSend(): SendTransactionRecord | undefined {
    return this.sendHistory[this.sendHistory.length - 1];
  }

  /**
   * The {@link SendTransactionRecord} history of the {@link TransactionContext}.
   */
  get sendHistory(): readonly SendTransactionRecord[] {
    return this.#sendHistory;
  }

  /**
   * The {@link TransactionSignature} of the latest sent {@link Transaction} or {@link VersionedTransaction}.
   *
   * `Note`: This is only set after the transaction has been sent.
   */
  get signature(): TransactionSignature | undefined {
    return this.latestSend?.signature;
  }

  /** @inheritdoc */
  async build(buildOpts: BuildTransactionOptions = {}): Promise<BuildTransactionRecord> {
    buildOpts.priorityFeeAugment ??= this.#sendHistory.length;
    const buildRecord = await super.build(buildOpts);
    this.#buildHistory.push(buildRecord);
    return buildRecord;
  }

  /**
   * Resets the {@link TransactionContext} to its initial state.
   *
   * @param opts The {@link ResetTransactionContextOptions} to use for resetting the context.
   * @returns This {@link TransactionContext} instance.
   */
  reset(opts?: ResetTransactionContextOptions): this;

  /**
   * Resets the {@link TransactionContext} to its initial state.
   *
   * @param instructionSet The {@link InstructionSet} to reset the state to.
   * @param opts The {@link ResetTransactionContextOptions} to use for resetting the context.
   * @returns This {@link TransactionContext} instance.
   */
  reset(instructionSet?: InstructionSet, opts?: ResetTransactionContextOptions): this;

  /**
   * Resets the {@link TransactionContext} to its initial state.
   *
   * @param optsOrState The {@link ResetTransactionContextOptions} or the {@link InstructionSet} to reset the state to.
   * If not provided, resets to an empty state.
   * @param opts The {@link ResetTransactionContextOptions} to use for resetting the context.
   * @returns This {@link TransactionContext} instance.
   */
  reset(
    optsOrState?: InstructionSet | ResetTransactionContextOptions,
    opts: ResetTransactionContextOptions = {}
  ): this {
    const instructionSet = ('instructions' in (optsOrState ?? {}))
      ? optsOrState as InstructionSet
      : undefined;

    opts ??= !('instructions' in (optsOrState ?? {}))
      ? optsOrState as ResetTransactionContextOptions
      : {};

    super.reset(instructionSet);

    if (!opts.retainBuildHistory) {
      this.#buildHistory = [];
    }

    if (!opts.retainSendHistory) {
      this.#sendHistory = [];
    }

    return this;
  }

  /**
   * Builds, signs, sends, and optionally confirms a {@link Transaction} or {@link VersionedTransaction}.
   *
   * @param sendOpts The {@link SendTransactionOptions} to use for sending the transaction.
   * @returns A {@link Promise} that resolves to the {@link SendTransactionRecord}.
   */
  async send(sendOpts: SendTransactionOptions = {}): Promise<TxSummary> {
    // Prepare send options
    sendOpts = { ...TransactionContext.DEFAULT_SEND_TX_OPTS, ...this.sendOpts, ...sendOpts };

    // Transaction send record - added to history on both success and error
    let sendRecord: SendTransactionRecord = { sendOpts };

    try {
      const signature = await expBackoff(async (retry: number) => {
        sendRecord = { sendOpts }; // Reset send record on each attempt

        // Build transaction - use latest build if specified and initial try
        const buildRecord = (sendOpts.useLatestBuild && retry === 0)
          ? this.latestBuild ?? await this.build(sendOpts.buildOpts)
          : await this.build(sendOpts.buildOpts);

        // Record and extract transaction build data
        sendRecord.buildRecord = buildRecord;
        const { blockhashWithExpiry, tx } = buildRecord;

        // Send transaction
        const signature = await sendTx(tx, sendOpts);
        sendRecord.signature = signature;

        // Confirm transaction
        if (!sendOpts.skipConfirm) {
          await confirmTx(signature, {
            blockhashWithExpiry,
            debugData: sendOpts.debugData,
            commitment: sendOpts.preflightCommitment,
          });
        }

        return signature;
      }, {
        // Record send history after each send attempt
        afterAttempt: (attempt, result, err) => {
          sendRecord.err = err;
          this.#sendHistory.push(sendRecord);
        },
        // Retry on typical blockhash transaction errors
        retryFilter: (result, err) => !sendOpts.disableRetry && (
             !!(err as SendTransactionError)?.stack?.includes('TransactionExpiredBlockheightExceededError') // Blockhash 'too old' - tx wasn't processed in time.
          || !!(err as SendTransactionError)?.stack?.includes('Blockhash not found')                        // Blockhash 'too new' - RPC node is behind or on minority fork.
        ),
      });

      return getTxSummary(signature);
    } catch (err) {
      warn('Send Tx failed:', sendOpts.debugData);
      throw err;
    }
  }

  /**
   * Simulates the {@link Transaction} or {@link VersionedTransaction}.
   *
   * @param opts The {@link SimulateTransactionConfig} to use for simulating the transaction.
   * @returns A {@link Promise} that resolves when the transaction has been simulated.
   * @throws If the simulation fails.
   */
  async simulate(opts: SimulateTransactionOptions = {}): Promise<SimulatedTransactionResponse> {
    const buildRecord = opts.useLatestBuild
      ? this.latestBuild ?? await this.build(opts.buildOpts)
      : await this.build(opts.buildOpts);

    return simulateTx(buildRecord.tx, opts);
  }

}

export type * from './transaction-context.interfaces';
export default TransactionContext;
