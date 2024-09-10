import { expBackoff, warn } from '@npc/core';
import env from '@npc/solana/util/env/env';
import TransactionBuilder from '@npc/solana/util/transaction-builder/transaction-builder';
import { confirmTx, sendTx, simulateTx } from '@npc/solana/util/transaction-exec/transaction-exec';
import { SimulatedTransactionResponse, type SendTransactionError, type Signer, type SimulateTransactionConfig, type Transaction, type TransactionInstruction, type TransactionSignature, type VersionedTransaction } from '@solana/web3.js';
import { getTxSummary, TxSummary } from '../transaction-query/transaction-query';
import type { BuildTransactionOptions, BuildTransactionRecord, ConfirmTransactionOptions, InstructionSet, InstructionSetObject, ResetTransactionContextOptions, SendTransactionOptions, SendTransactionRecord, SimulateTransactionOptions, TransactionContextOptions, TransactionMetadata } from './transaction-context.interfaces';

/**
 * A context for building, sending, confirming, and retrying {@link Transaction}s or {@link VersionedTransaction}s.
 *
 * @param T The {@link InstructionSetObject} that describes the instruction sets contained in this context.
 */
export class TransactionContext<
  T extends InstructionSetObject = InstructionSetObject
> implements InstructionSet<TransactionMetadata<T>> {

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

  readonly #builder: TransactionBuilder;
  readonly #instructionSetMap = new Map<keyof T, T[keyof T]>();

  #sendHistory: SendTransactionRecord[] = [];

  /**
   * Constructs a new {@link TransactionContext}.
   *
   * @param ctxOpts The {@link TransactionContextOptions} to use for the {@link TransactionContext} instance.
   */
  constructor(ctxOpts: TransactionContextOptions = {}) {
    this.#builder = new TransactionBuilder(ctxOpts.buildOpts);
    this.confirmOpts = ctxOpts.confirmOpts ?? {};
    this.sendOpts = ctxOpts.sendOpts ?? {};
  }

  /**
   * Constructs a new {@link TransactionContext} from a single {@link InstructionSet}.
   *
   * @param ixSet The {@link InstructionSet} to construct the {@link TransactionContext} from.
   * @param ctxOpts The {@link TransactionContextOptions} to use for the {@link TransactionContext} instance.
   * @returns A new {@link TransactionContext} instance.
   */
  static fromIxSet<T extends InstructionSet>(
    ixSet: T,
    ctxOpts: TransactionContextOptions = {}
  ): TransactionContext<{ 'default': T }> {
    return new TransactionContext<{ 'default': T }>(ctxOpts)
      .setInstructionSet('default', ixSet);
  }

  /**
   * The {@link BuildTransactionRecord} history of the {@link TransactionContext}.
   */
  get buildHistory(): readonly BuildTransactionRecord[] {
    return this.#builder.buildHistory;
  }

  /**
   * The cleanup {@link TransactionInstruction}s of the {@link TransactionContext}.
   */
  get cleanupInstructions(): readonly TransactionInstruction[] {
    return this.#instructionSetArray.reverse().flatMap(
      (ctx) => ctx.cleanupInstructions
    );
  }

  /**
   * The {@link TransactionInstruction}s of the {@link TransactionContext}.
   */
  get instructions(): readonly TransactionInstruction[] {
    return this.#instructionSetArray.flatMap(
      (ctx) => ctx?.instructions
    );
  }

  /**
   * The latest {@link BuildTransactionRecord} of the {@link TransactionContext}.
   */
  get latestBuild(): BuildTransactionRecord | undefined {
    return this.#builder.latestBuild;
  }

  /**
   * The latest {@link SendTransactionRecord} of the {@link TransactionContext}.
   */
  get latestSend(): SendTransactionRecord | undefined {
    return this.sendHistory[this.sendHistory.length - 1];
  }

  /**
   * The metadata of the {@link TransactionContext}.
   */
  get metadata(): TransactionMetadata<T> {
    return Object.fromEntries(
      Array.from(this.#instructionSetMap.entries()).map(
        ([key, ixSet]) => [key, ixSet.metadata]
      )
    ) as TransactionMetadata<T>;
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

  /**
   * The {@link Signer}s of the {@link TransactionContext}.
   */
  get signers(): readonly Signer[] {
    return this.#instructionSetArray.flatMap(
      (builder) => builder.signers
    );
  }

  /**
   * Array of {@link InstructionSet}s of the {@link TransactionContext}.
   */
  get #instructionSetArray(): T[keyof T][] {
    return Array.from(this.#instructionSetMap.values()) as T[keyof T][];
  }

  /**
   * Builds a {@link Transaction} or {@link VersionedTransaction} from the {@link TransactionContext}.
   *
   * @param opts The {@link BuildTransactionOptions} to use for building the transaction.
   * @returns A {@link Promise} that resolves to the {@link BuildTransactionRecord}.
   */
  async build(opts: BuildTransactionOptions = {}): Promise<BuildTransactionRecord> {
    opts.debugData ??= this.metadata;

    return this.#builder
      .reset({ retainBuildHistory: true })
      .addCleanupInstructions(...this.cleanupInstructions)
      .addInstructions(...this.instructions)
      .addSigners(...this.signers)
      .build(opts);
  }

  /**
   * Resets the {@link TransactionContext} to its initial state.
   *
   * @param opts The {@link ResetTransactionContextOptions} to use for resetting the context.
   * @returns This {@link TransactionContext} instance.
   */
  reset(opts: ResetTransactionContextOptions = {}): this {
    this.#builder.reset(opts);

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
  async send(sendOpts: SendTransactionOptions = {}): Promise<TxSummary<this>> {
    // Prepare send options
    sendOpts = { ...TransactionContext.DEFAULT_SEND_TX_OPTS, ...this.sendOpts, ...sendOpts };
    sendOpts.debugData ??= this.metadata;

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

      const txSummary = await getTxSummary(signature);
      return { ...txSummary, instructionSet: this };
    } catch (err) {
      warn('Send Tx failed:', sendOpts.debugData);
      throw err;
    }
  }

  /**
   * Gets the {@link InstructionSet} with the given name.
   *
   * @param name The name of the {@link InstructionSet} to get.
   * @returns The {@link InstructionSet} with the given name.
   */
  getInstructionSet<K extends keyof T>(name: K): T[K] | undefined {
    return this.#instructionSetMap.get(name) as T[K] | undefined;
  }

  /**
   * Sets the {@link InstructionSet} with the given name.
   *
   * @param name The name of the {@link InstructionSet} to set.
   * @param value The {@link InstructionSet} to set.
   * @returns This {@link TransactionContext} instance.
   */
  setInstructionSet<K extends keyof T>(name: K, value: T[K]): this {
    this.#instructionSetMap.set(name, value);
    return this;
  }

  /**
   * Simulates the {@link Transaction} or {@link VersionedTransaction}.
   *
   * @param opts The {@link SimulateTransactionConfig} to use for simulating the transaction.
   * @returns A {@link Promise} that resolves when the transaction has been simulated.
   * @throws If the simulation fails.
   */
  async simulate(opts: SimulateTransactionOptions = {}): Promise<SimulatedTransactionResponse> {
    opts.debugData ??= this.metadata;

    const buildRecord = opts.useLatestBuild
      ? this.latestBuild ?? await this.build(opts.buildOpts)
      : await this.build(opts.buildOpts);

    return simulateTx(buildRecord.tx, opts);
  }

}

export type * from './transaction-context.interfaces';
export default TransactionContext;
