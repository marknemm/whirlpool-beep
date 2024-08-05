import type { Instruction, TransactionBuilder } from '@orca-so/common-sdk';
import type { CollectFeesQuote, CollectRewardsQuote, Position } from '@orca-so/whirlpools-sdk';
import type BN from 'bn.js';

/**
 * The result of generating an {@link Instruction} to collect fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsIx extends CollectFeesRewardsIxTxAssocData {

  /**
   * The {@link Instruction} for collecting fees and rewards.
   */
  ix: Instruction;

}

/**
 * Container for the {@link CollectFeesQuote} and {@link CollectRewardsQuote}
 * used to generate a collect fees and rewards transaction.
 */
export interface CollectFeesRewardsQuotes {

  /**
   * The {@link CollectFeesQuote} used to generate the transaction.
   */
  collectFeesQuote: CollectFeesQuote;

  /**
   * The {@link CollectRewardsQuote} used to generate the transaction.
   */
  collectRewardsQuote: CollectRewardsQuote;

}

/**
 * The result of generating a transaction to collect fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsTx extends CollectFeesRewardsIxTxAssocData {

  /**
   * The {@link TransactionBuilder} for collecting fees and rewards.
   */
  tx: TransactionBuilder;

}

/**
 * Data associated with collect fees and rewards transaction instructions and transactions.
 */
interface CollectFeesRewardsIxTxAssocData {

  /**
   * The collect fees {@link Instruction}.
   */
  collectFeesIx?: Instruction;

  /**
   * The {@link CollectFeesQuote} used to generate the transaction.
   */
  collectFeesQuote: CollectFeesQuote;

  /**
   * The collect rewards {@link Instruction}s.
   */
  collectRewardsIxs: Instruction[];

  /**
   * The {@link CollectRewardsQuote} used to generate the transaction.
   */
  collectRewardsQuote: CollectRewardsQuote;

}

/**
 * Summary of a collect fees and rewards transaction for a {@link Position}.
 */
export interface CollectFeesRewardsTxSummary {

  // TODO: Add rewards field(s).

  /**
   * The fee paid for the transaction in lamports.
   */
  fee: number;

  /**
   * The {@link Position} that the fees and rewards are associated with.
   */
  position: Position;

  /**
   * The signature of the transaction.
   */
  signature: string;

  /**
   * The amount of token A fees that were collected.
   */
  tokenAmountA: BN;

  /**
   * The amount of token B fees that were collected.
   */
  tokenAmountB: BN;

  /**
   * The total USD value of the fees and rewards collection.
   */
  usd: number;

}
