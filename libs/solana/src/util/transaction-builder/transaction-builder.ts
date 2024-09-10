import { debug, warn, type Null } from '@npc/core';
import { genComputeBudget } from '@npc/solana/util/compute-budget/compute-budget';
import env from '@npc/solana/util/env/env';
import rpc from '@npc/solana/util/rpc/rpc';
import { signTx, toTxInstructions } from '@npc/solana/util/transaction-exec/transaction-exec';
import wallet from '@npc/solana/util/wallet/wallet';
import { Transaction, TransactionMessage, VersionedTransaction, type Signer, type TransactionInstruction } from '@solana/web3.js';
import type { BuildTransactionOptions, BuildTransactionRecord, InstructionSet, ResetTransactionBuilderOptions } from './transaction-builder.interfaces';

/**
 * A builder for constructing a {@link Transaction}.
 */
export class TransactionBuilder {

  /**
   * The default {@link BuildTransactionOptions} to use for building a {@link Transaction} or {@link VersionedTransaction}.
   */
  static readonly DEFAULT_BUILD_TX_OPTS: BuildTransactionOptions = {
    commitment: env.COMMITMENT_DEFAULT,
    computeBudget: env.PRIORITY_LEVEL_DEFAULT,
    version: 0,
  };

  #buildHistory: BuildTransactionRecord[] = [];
  #cleanupInstructions: TransactionInstruction[] = [];
  #instructions: TransactionInstruction[] = [];
  #signers: Signer[] = [];

  /**
   * Constructs a new {@link TransactionBuilder} instance.
   *
   * @param buildOpts The {@link BuildTransactionOptions} to use for building the transaction.
   */
  constructor(
    public readonly buildOpts: BuildTransactionOptions = {}
  ) {}

  /**
   * Constructs a new {@link TransactionBuilder} from a {@link Transaction} or {@link VersionedTransaction} and {@link Signer}s.
   *
   * @param tx The {@link Transaction} or {@link VersionedTransaction} to construct the {@link TransactionBuilder} from.
   * @param signers The {@link Signer}s to construct the {@link TransactionBuilder} from.
   * @param buildOpts The {@link BuildTransactionOptions} to use for building the transaction.
   * @returns A new {@link TransactionBuilder} instance.
   */
  static fromTx(
    tx: Transaction | VersionedTransaction,
    signers: Signer | readonly Signer[] = [],
    buildOpts: BuildTransactionOptions = {}
  ): TransactionBuilder {
    const instructions = toTxInstructions(tx);

    if (signers && !(signers instanceof Array)) {
      signers = [signers];
    }

    return new TransactionBuilder(buildOpts)
      .addInstructions(...instructions)
      .addSigners(...signers);
  }

  /**
   * The {@link BuildTransactionRecord} history of the {@link TransactionBuilder}.
   */
  get buildHistory(): readonly BuildTransactionRecord[] {
    return this.#buildHistory;
  }

  /**
   * The {@link TransactionInstruction}s used to cleanup temp accounts in the transaction.
   */
  get cleanupInstructions(): readonly TransactionInstruction[] {
    return this.#cleanupInstructions;
  }

  /**
   * The {@link TransactionInstruction}s of the {@link TransactionBuilder}.
   */
  get instructions(): readonly TransactionInstruction[] {
    return this.#instructions;
  }

  /**
   * The {@link InstructionSet} contained in the {@link TransactionBuilder}.
   */
  get instructionSet(): InstructionSet {
    return {
      cleanupInstructions: this.cleanupInstructions,
      instructions: this.instructions,
      metadata: {},
      signers: this.signers,
    };
  }

  /**
   * The latest {@link BuildTransactionRecord} of the {@link TransactionBuilder}.
   */
  get latestBuild(): BuildTransactionRecord | undefined {
    return this.#buildHistory[this.#buildHistory.length - 1];
  }

  /**
   * The {@link Signer}s of the {@link TransactionBuilder}.
   */
  get signers(): readonly Signer[] {
    return this.#signers;
  }

  /**
   * Adds {@link TransactionInstruction}s that are used to cleanup temp accounts to the {@link TransactionBuilder}.
   *
   * @param cleanupInstructions The {@link TransactionInstruction}(s) to add to the {@link TransactionBuilder}.
   * @returns This {@link TransactionBuilder} instance.
   */
  addCleanupInstructions(...cleanupInstructions: (TransactionInstruction | Null)[]): this {
    // Filter out null/undefined instructions
    cleanupInstructions = cleanupInstructions.filter((ix) => ix);

    // Cleanup instructions are added in reverse order
    this.#cleanupInstructions.unshift(...cleanupInstructions as TransactionInstruction[]);

    return this;
  }

  /**
   * Adds {@link TransactionInstruction}s to the {@link TransactionBuilder}.
   *
   * @param instructions The {@link TransactionInstruction}(s) to add to the {@link TransactionBuilder}.
   * @returns This {@link TransactionBuilder} instance.
   */
  addInstructions(...instructions: (TransactionInstruction | Null)[]): this {
    // Filter out null/undefined instructions & debugData
    instructions = instructions?.filter((ix) => ix);

    this.#instructions.push(...instructions as TransactionInstruction[]);

    return this;
  }

  /**
   * Adds {@link Signer}(s) to the {@link TransactionBuilder}.
   *
   * @param signers The {@link Signer}(s) to add to the {@link TransactionBuilder}.
   * @returns This {@link TransactionBuilder} instance.
   */
  addSigners(...signers: (Signer | Null)[]): this {
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
    buildOpts = { ...TransactionBuilder.DEFAULT_BUILD_TX_OPTS, ...this.buildOpts, ...buildOpts };
    buildOpts.wallet ??= wallet();

    const opMeta = {
      debugData: buildOpts.debugData,
      version: buildOpts.version,
      payer: buildOpts.wallet.publicKey.toBase58(),
      commitment: buildOpts.commitment,
      computeBudget: buildOpts.computeBudget,
      instructionCnt: this.instructions.length + this.cleanupInstructions.length,
      signerCnt: this.signers.length,
      buildAttempt: this.#buildHistory.length,
    };

    try {
      debug('Building Tx:', opMeta);

      // Gen compute budget and get latest blockhash timestamp for build
      const computeBudget = await genComputeBudget(
        this.instructions,
        buildOpts.computeBudget,
        this.#buildHistory.length
      );
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

      // Sign transaction if not skipped
      if (!buildOpts.skipSign) {
        await signTx(tx, {
          debugData: buildOpts.debugData,
          payerWallet: buildOpts.wallet,
          signers: this.signers
        });
      }

      // Record new build history
      const buildRecord: BuildTransactionRecord = {
        blockhashWithExpiry,
        buildOpts,
        computeBudget,
        timestamp: Date.now(),
        tx,
        wallet: buildOpts.wallet,
      };

      const { computeUnitLimit, priorityFeeLamports } = computeBudget;
      debug('Tx built:', {
        ...opMeta,
        ...blockhashWithExpiry,
        computeUnitLimit,
        priorityFeeLamports,
      });

      this.#buildHistory.push(buildRecord);
      return buildRecord;
    } catch (err) {
      warn('Tx build failed:', opMeta);
      throw err;
    }
  }

  /**
   * Resets the {@link TransactionBuilder} to its initial state.
   *
   * @param opts The {@link ResetTransactionBuilderOptions} to use for resetting the builder.
   * @returns This {@link TransactionBuilder} instance.
   */
  reset(opts: ResetTransactionBuilderOptions = {}): this {
    this.#cleanupInstructions = [];
    this.#instructions = [];
    this.#signers = [];

    if (!opts.retainBuildHistory) {
      this.#buildHistory = [];
    }

    return this;
  }

}

export type * from './transaction-builder.interfaces';
export default TransactionBuilder;
