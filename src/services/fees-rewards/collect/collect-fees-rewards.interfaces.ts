import type { InstructionData } from '@/util/transaction-context/transaction-context.interfaces';
import { TransactionSummary } from '@/util/transaction-query/transaction-query.interfaces';
import type { CollectFeesQuote, CollectRewardsQuote, Position } from '@orca-so/whirlpools-sdk';
import type { TransactionSignature } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * {@link InstructionData} for collecting fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsIxData extends InstructionData {

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
 * Summary of a collect fees and rewards transaction for a {@link Position}.
 */
export interface CollectFeesRewardsTxSummary extends TransactionSummary {

  // TODO: Add rewards field(s).

  /**
   * The {@link Position} that the fees and rewards are associated with.
   */
  position: Position;

  /**
   * The signature of the transaction.
   */
  signature: TransactionSignature;

  /**
   * The amount of token A fees that were collected.
   */
  tokenAmountA: BN;

  /**
   * The amount of token B fees that were collected.
   */
  tokenAmountB: BN;

}
