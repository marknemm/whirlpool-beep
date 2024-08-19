import type { Null } from '@/interfaces/nullable.interfaces';
import { expBackoff } from '@/util/async/async';
import env from '@/util/env/env';
import { info, warn } from '@/util/log/log';
import rpc from '@/util/rpc/rpc';
import { genComputeBudget } from '@/util/transaction-budget/transaction-budget';
import { confirmTx, getTxInstructions, sendTx, signTx, simulateTx } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import { SimulatedTransactionResponse, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction, type SendTransactionError, type Signer, type TransactionSignature } from '@solana/web3.js';
import { green } from 'colors';
import type { BuildTransactionOptions, BuildTransactionRecord, ConfirmTransactionOptions, InstructionData, InstructionMetadata, SendTransactionOptions, SendTransactionRecord, SendTransactionResult, SignTransactionOptions, SimulateTransactionOptions, TransactionCtxOptions } from './transaction-context.interfaces';

/**
 * A context for building, sending, confirming, and retrying {@link Transaction}s or {@link VersionedTransaction}s.
 */
export default class TransactionContext {

  /**
   * The default {@link BuildTransactionOptions} to use for building a {@link Transaction} or {@link VersionedTransaction}.
   */
  static readonly DEFAULT_BUILD_TX_OPTS: BuildTransactionOptions = {
    commitment: env.COMMITMENT_DEFAULT,
    computeBudget: env.PRIORITY_LEVEL_DEFAULT,
    version: 0,
  };

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

  readonly buildOpts: BuildTransactionOptions;
  readonly confirmOpts: ConfirmTransactionOptions;
  readonly sendOpts: SendTransactionOptions;

  readonly #buildHistory: BuildTransactionRecord[] = [];
  readonly #sendHistory: SendTransactionRecord[] = [];

  #cleanupInstructions: TransactionInstruction[] = [];
  #instructions: TransactionInstruction[] = [];
  #metadata: InstructionMetadata[] = [];
  #signers: Signer[] = [];

  /**
   * Constructs a new {@link TransactionContext}.
   *
   * @param ctxOpts The {@link TransactionCtxOptions} to use for the {@link TransactionContext} instance.
   */
  constructor(ctxOpts: TransactionCtxOptions = {}) {
    this.buildOpts = ctxOpts.buildOpts ?? {};
    this.confirmOpts = ctxOpts.confirmOpts ?? {};
    this.sendOpts = ctxOpts.sendOpts ?? {};
  }

  /**
   * Constructs a new {@link TransactionContext} from a {@link Transaction} or {@link VersionedTransaction} and {@link Signer}s.
   *
   * @param tx The {@link Transaction} or {@link VersionedTransaction} to construct the {@link TransactionContext} from.
   * @param signers The {@link Signer}s to construct the {@link TransactionContext} from.
   * @param ctxOpts The {@link TransactionCtxOptions} to use for the {@link TransactionContext} instance.
   * @returns A new {@link TransactionContext} instance.
   */
  static from(
    tx: Transaction | VersionedTransaction,
    signers?: Signer | readonly Signer[],
    ctxOpts?: TransactionCtxOptions
  ): TransactionContext;

  /**
   * Constructs a new {@link TransactionContext} from {@link TransactionInstruction}s and {@link Signer}s.
   *
   * @param ixs The {@link TransactionInstruction}(s) to construct the {@link TransactionContext} from.
   * @param signers The {@link Signer}s to construct the {@link TransactionContext} from.
   * @param ctxOpts The {@link TransactionCtxOptions} to use for the {@link TransactionContext} instance.
   * @returns A new {@link TransactionContext} instance.
   */
  static from(
    ixs: TransactionInstruction | TransactionInstruction[],
    signers?: Signer | readonly Signer[],
    ctxOpts?: TransactionCtxOptions
  ): TransactionContext;

  /**
   * Constructs a new {@link TransactionContext} from a {@link Transaction} or {@link VersionedTransaction} and {@link Signer}s.
   *
   * @param ixsOrTx The {@link TransactionInstruction}s {@link Transaction} or {@link VersionedTransaction} to construct
   * the {@link TransactionContext} from.
   * @param signers The {@link Signer}s to construct the {@link TransactionContext} from.
   * @param ctxOpts The {@link TransactionCtxOptions} to use for the {@link TransactionContext} instance.
   * @returns A new {@link TransactionContext} instance.
   */
  static from(
    ixsOrTx: Transaction | VersionedTransaction | TransactionInstruction | TransactionInstruction[],
    signers: Signer | readonly Signer[] = [],
    ctxOpts: TransactionCtxOptions = {}
  ): TransactionContext {
    const instructions = (ixsOrTx instanceof Transaction || ixsOrTx instanceof VersionedTransaction)
      ? getTxInstructions(ixsOrTx)
      : (ixsOrTx instanceof Array)
        ? ixsOrTx
        : [ixsOrTx];

    if (signers && !(signers instanceof Array)) {
      signers = [signers];
    }

    return new TransactionContext(ctxOpts)
      .addInstructions(...instructions)
      .addSigners(...signers);
  }

  /**
   * The {@link BuildTransactionRecord} history of the {@link TransactionContext}.
   */
  get buildHistory(): readonly BuildTransactionRecord[] {
    return this.#buildHistory;
  }

  /**
   * The {@link TransactionInstruction}s used to cleanup temp accounts of the {@link TransactionContext}.
   */
  get cleanupInstructions(): readonly TransactionInstruction[] {
    return this.#cleanupInstructions;
  }

  /**
   * The {@link TransactionInstruction}s of the {@link TransactionContext}.
   */
  get instructions(): readonly TransactionInstruction[] {
    return this.#instructions;
  }

  /**
   * The latest {@link BuildTransactionRecord} of the {@link TransactionContext}.
   */
  get latestBuild(): BuildTransactionRecord | undefined {
    return this.#buildHistory[this.#buildHistory.length - 1];
  }

  /**
   * The latest {@link SendTransactionRecord} of the {@link TransactionContext}.
   */
  get latestSend(): SendTransactionRecord | undefined {
    return this.#sendHistory[this.#sendHistory.length - 1];
  }

  /**
   * The {@link InstructionMetadata} of the {@link TransactionContext}.
   */
  get metadata(): readonly InstructionMetadata[] {
    return this.#metadata;
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
    return this.#signers;
  }

  /**
   * Adds {@link TransactionInstruction}s that are used to cleanup temp accounts to the {@link TransactionContext}.
   *
   * @param cleanupInstructions The {@link TransactionInstruction}(s) to add to the {@link TransactionContext}.
   * @returns This {@link TransactionContext} instance.
   */
  addCleanupInstructions(...cleanupInstructions: (TransactionInstruction | Null)[]): TransactionContext {
    // Filter out null/undefined instructions
    cleanupInstructions = cleanupInstructions.filter((ix) => ix);

    // Cleanup instructions are added in reverse order
    this.#cleanupInstructions.unshift(...cleanupInstructions as TransactionInstruction[]);

    return this;
  }

  /**
   * Adds {@link TransactionInstruction}s to the {@link TransactionContext}.
   *
   * @param instructions The {@link TransactionInstruction}(s) to add to the {@link TransactionContext}.
   * @returns This {@link TransactionContext} instance.
   */
  addInstructions(...instructions: (TransactionInstruction | Null)[]): TransactionContext {
    // Filter out null/undefined instructions & metadata
    instructions = instructions?.filter((ix) => ix);

    this.#instructions.push(...instructions as TransactionInstruction[]);

    return this;
  }

  /**
   * Adds {@link InstructionData} to the {@link TransactionContext}.
   *
   * @param instructionData The {@link InstructionData} to add to the {@link TransactionContext}.
   * @returns This {@link TransactionContext} instance.
   */
  addInstructionData(...instructionData: (InstructionData | Null)[]): TransactionContext {
    for (const datum of instructionData) {
      if (!datum) continue;

      const { cleanupInstructions = [], instructions, signers = [], ...metadata } = datum;

      this.addCleanupInstructions(...cleanupInstructions);
      this.addInstructions(...instructions);
      this.addMetadata(metadata);
      this.addSigners(...signers);
    }

    return this;
  }

  /**
   * Adds {@link InstructionMetadata}(s) to the {@link TransactionContext}.
   *
   * @param metadata The {@link InstructionMetadata}(s) to add to the {@link TransactionContext}.
   * @returns This {@link TransactionContext} instance.
   */
  addMetadata(metadata: InstructionMetadata | Null): TransactionContext {
    if (!metadata) return this;

    this.#metadata.push(metadata);

    return this;
  }

  /**
   * Adds {@link Signer}(s) to the {@link TransactionContext}.
   *
   * @param signers The {@link Signer}(s) to add to the {@link TransactionContext}.
   * @returns This {@link TransactionContext} instance.
   */
  addSigners(...signers: (Signer | Null)[]): TransactionContext {
    // Filter out null/undefined or duplicate signers
    signers = signers.filter((newSigner) =>
      newSigner && !this.#signers.find(
        (existingSigner) => existingSigner?.publicKey.equals(newSigner.publicKey)
      )
    );

    this.#signers.push(...signers as Signer[]);

    return this;
  }

  /**
   * Builds a {@link VersionedTransaction} that can be sent to the blockchain.
   *
   * @param buildOpts The {@link BuildTransactionOptions} to use for building the transaction.
   * Takes precedence over the instance and default build options.
   * @returns A {@link Promise} that resolves to the {@link BuildTransactionRecord}.
   */
  async build(buildOpts: BuildTransactionOptions = {}): Promise<BuildTransactionRecord> {
    buildOpts = { ...TransactionContext.DEFAULT_BUILD_TX_OPTS, ...this.buildOpts, ...buildOpts };
    buildOpts.wallet ??= wallet();

    const opMeta = {
      debugData: this.metadata.map((meta) => meta.debugData),
      version: buildOpts.version,
      payer: buildOpts.wallet.publicKey.toBase58(),
      commitment: buildOpts.commitment,
      computeBudget: buildOpts.computeBudget,
      instructionCnt: this.instructions.length + this.cleanupInstructions.length,
      signerCnt: this.signers.length,
      buildAttempt: this.buildHistory.length,
    };

    try {
      info('Building Tx:', opMeta);

      // Gen compute budget and get latest blockhash timestamp for build
      const computeBudget = await genComputeBudget(this.instructions, buildOpts.computeBudget, this.sendHistory.length);
      const blockhashWithExpiry = await rpc().getLatestBlockhash(buildOpts.commitment);

      // Build transaction with specified version
      const tx = (buildOpts.version === 'legacy')
        ? new Transaction({
            feePayer: buildOpts.wallet.publicKey,
            ...blockhashWithExpiry,
          }).add(...computeBudget.instructions, ...this.instructions, ...this.cleanupInstructions)
        : new VersionedTransaction(
            new TransactionMessage({
              instructions: [...computeBudget.instructions, ...this.instructions, ...this.cleanupInstructions],
              payerKey: buildOpts.wallet.publicKey,
              recentBlockhash: blockhashWithExpiry.blockhash,
            }).compileToV0Message(buildOpts.addressLookupTableAccounts)
          );

      // Record new build history
      const buildRecord: BuildTransactionRecord = {
        blockhashWithExpiry,
        buildOpts,
        computeBudget,
        metadata: this.metadata,
        signed: false,
        simulated: false,
        timestamp: Date.now(),
        tx,
        wallet: buildOpts.wallet,
      };
      this.#buildHistory.push(buildRecord);

      const { computeUnitLimit, priorityFeeLamports } = computeBudget;
      info('Tx built:', {
        ...opMeta,
        ...blockhashWithExpiry,
        computeUnitLimit,
        priorityFeeLamports,
      });

      return buildRecord;
    } catch (err) {
      warn('Tx build failed:', opMeta);
      throw err;
    }
  }

  /**
   * Confirms that a {@link Transaction} has been committed to the blockchain.
   *
   * @param opts The {@link ConfirmTransactionOptions} to use for confirming the transaction.
   * @returns A {@link Promise} that resolves to the {@link SendTransactionRecord} that was confirmed.
   */
  async confirm(opts: ConfirmTransactionOptions = {}): Promise<SendTransactionRecord> {
    const sendRecord = this.latestSend;
    if (!sendRecord) {
      throw new Error('No transaction record to confirm');
    }

    return this.#confirm(sendRecord, opts);
  }

  /**
   * Confirms that a {@link Transaction} in a given {@link SendTransactionRecord} has been committed to the blockchain.
   *
   * @param sendRecord The {@link SendTransactionRecord} containing the transaction to confirm.
   * @param opts The {@link ConfirmTransactionOptions} to use for confirming the transaction.
   * @returns A {@link Promise} that resolves to the {@link SendTransactionRecord} that was confirmed.
   */
  async #confirm(
    sendRecord: SendTransactionRecord,
    opts: ConfirmTransactionOptions = {}
  ): Promise<SendTransactionRecord> {
    opts = { ...TransactionContext.DEFAULT_CONFIRM_TX_OPTS, ...this.confirmOpts, ...opts };
    const { commitment = env.COMMITMENT_DEFAULT } = opts;

    const { signature } = sendRecord;
    if (!signature) {
      throw new Error('No transaction signature to confirm');
    }

    info(`Confirming Tx ( Commitment: ${green(commitment)} ):`, signature);

    // Wait for the transaction to be confirmed or rejected.
    await confirmTx(signature, commitment, opts.blockhashWithExpiry);

    sendRecord.confirmed = true;
    info('Tx confirmed:', signature);
    return sendRecord;
  }

  /**
   * Resets the {@link InstructionData} in this {@link TransactionContext} instance.
   *
   * Clears {@link instructions}, {@link metadata}, and {@link signers}.
   *
   * @param instructionData The {@link InstructionData} to reset the {@link TransactionContext} with.
   * @returns This {@link TransactionContext} instance.
   */
  resetInstructionData(...instructionData: (InstructionData | Null)[]): TransactionContext {
    this.#cleanupInstructions = [];
    this.#instructions = [];
    this.#metadata = [];
    this.#signers = [];

    return this.addInstructionData(...instructionData);
  }

  /**
   * Builds, signs, sends, and optionally confirms a {@link Transaction} or {@link VersionedTransaction}.
   *
   * @param sendOpts The {@link SendTransactionOptions} to use for sending the transaction.
   * @returns A {@link Promise} that resolves to the {@link SendTransactionRecord}.
   */
  async send(sendOpts: SendTransactionOptions = {}): Promise<SendTransactionResult> {
    // Prepare send options
    sendOpts = { ...TransactionContext.DEFAULT_SEND_TX_OPTS, ...this.sendOpts, ...sendOpts };
    const debugData = this.metadata.map((meta) => meta.debugData);

    // Transaction send record - added to history on both success and error
    let sendRecord: SendTransactionRecord = { confirmed: false, sendOpts };

    try {
      return await expBackoff(
        async (retry: number) => {
          // Build transaction - use latest build if specified and initial try
          const buildRecord = (sendOpts.useLatestBuild && retry === 0)
            ? this.latestBuild ?? await this.build(sendOpts.buildOpts)
            : await this.build(sendOpts.buildOpts);

          // Record and extract transaction build data
          sendRecord.buildRecord = buildRecord;
          const { blockhashWithExpiry, computeBudget, tx } = buildRecord;
          const { computeUnitLimit, priorityFeeLamports } = computeBudget;

          info('Sending Tx:', {
            debugData,
            computeUnitLimit,
            priorityFeeLamports,
            sendAttempt: this.sendHistory.length
          });

          // Sign transaction
          await this.#sign(buildRecord);

          // Send transaction
          const signature = await sendTx(tx, sendOpts);
          sendRecord.signature = signature;

          // Record transaction send history
          info('Tx sent:', { debugData, signature });

          // Confirm transaction if not skipped
          if (!sendOpts.skipConfirm) {
            await this.#confirm(sendRecord, {
              ...blockhashWithExpiry,
              commitment: sendOpts.confirmCommitment,
            });
          }

          return {
            buildRecord,
            confirmed: sendRecord.confirmed,
            sendOpts,
            sendHistory: this.sendHistory,
            signature,
          };
        },
        {
          // Record send history after each send attempt
          afterAttempt: (attempt, result, err) => {
            sendRecord.err = err;
            this.#sendHistory.push(sendRecord);
            sendRecord = { confirmed: false, sendOpts };
          },
          // Retry on typical blockhash transaction errors
          retryFilter: (result, err) =>
               !!(err as SendTransactionError)?.stack?.includes('TransactionExpiredBlockheightExceededError') // Blockhash 'too old' - tx wasn't processed in time.
            || !!(err as SendTransactionError)?.stack?.includes('Blockhash not found'),                       // Blockhash 'too new' - RPC node is behind or on minority fork.
        }
      );
    } catch (err) {
      warn('Tx execution failed:', debugData);
      throw err;
    }
  }

  /**
   * Signs the {@link Transaction} or {@link VersionedTransaction}.
   *
   * @param signOpts The {@link SignTransactionOptions} to use for signing the transaction.
   * @returns A {@link Promise} that resolves to the {@link BuildTransactionRecord} after signing.
   */
  async sign(signOpts: SignTransactionOptions = {}): Promise<BuildTransactionRecord | undefined> {
    const buildRecord = this.latestBuild;
    if (!buildRecord) return;

    return this.#sign(buildRecord, signOpts);
  }

  /**
   * Signs the {@link Transaction} or {@link VersionedTransaction} in the given {@link BuildTransactionRecord}.
   *
   * @param buildRecord The {@link BuildTransactionRecord} containing the transaction to sign.
   * @param signOpts The {@link SignTransactionOptions} to use for signing the transaction.
   * @returns A {@link Promise} that resolves to the {@link BuildTransactionRecord} after signing.
   */
  async #sign(
    buildRecord: BuildTransactionRecord,
    signOpts: SignTransactionOptions = {}
  ): Promise<BuildTransactionRecord> {
    const { retainPreviousSignatures = false } = signOpts;
    const { tx } = buildRecord;

    if (!retainPreviousSignatures) {
      tx.signatures = [];
    }

    await signTx(tx, this.signers, buildRecord.wallet);
    buildRecord.signed = true;

    return buildRecord;
  }

  /**
   * Simulates the {@link Transaction} or {@link VersionedTransaction}.
   *
   * @param simulateOpts The {@link SimulateTransactionOptions} to use for simulating the transaction.
   * @returns A {@link Promise} that resolves when the transaction has been simulated.
   * @throws If the simulation fails.
   */
  async simulate(simulateOpts: SimulateTransactionOptions = {}): Promise<SimulatedTransactionResponse> {
    const { replaceRecentBlockhash = false, sigVerify = true } = simulateOpts;

    const buildRecord = simulateOpts.useLatestBuild
      ? this.latestBuild ?? await this.build(simulateOpts.buildOpts)
      : await this.build(simulateOpts.buildOpts);
    const { tx } = buildRecord;

    const opMeta = {
      replaceRecentBlockhash,
      sigVerify,
      debugData: this.metadata.map((meta) => meta.debugData),
    };
    info('Simulating Tx:', opMeta);

    const response = await simulateTx(tx, simulateOpts);

    info('Tx simulated:', {
      ...opMeta,
      computeUnits: response.unitsConsumed,
      logs: response.logs,
    });
    return response;
  }

}

export type * from './transaction-context.interfaces';
