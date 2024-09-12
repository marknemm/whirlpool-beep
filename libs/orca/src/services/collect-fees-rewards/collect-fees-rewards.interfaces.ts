import type { Address } from '@coral-xyz/anchor';
import type { InstructionSet, TxSummary } from '@npc/solana';
import type { CollectFeesQuote, CollectRewardsQuote, Position } from '@orca-so/whirlpools-sdk';

/**
 * Arguments for collecting fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsArgs {

  /**
   * The {@link Address} of the {@link Position} to collect fees and rewards from.
   */
  position: Address | Position;

  /**
   * Whether to update the fees and rewards before collecting.
   *
   * Defaults to whether or not the {@link Position} has liquidity.
   */
  updateFeesAndRewards?: boolean;

}

/**
 * Data for collecting fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsData extends CollectFeesRewardsQuotes {

  /**
   * The {@link Address} of the {@link Position} to collect fees and rewards from.
   */
  positionAddress: Address;

  /**
   * The token mint pair of the {@link Position}.
   */
  tokenMintPair: [Address, Address];

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
 * The {@link InstructionSet} for collecting fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsIxSet extends InstructionSet {

  /**
   * The {@link CollectFeesRewardsData} for the collect fees and rewards transaction.
   */
  data: CollectFeesRewardsData;

}

/**
 * The {@link TxSummary} for collecting fees and rewards from a {@link Position}.
 */
export interface CollectFeesRewardsSummary extends TxSummary {

  /**
   * The {@link CollectFeesRewardsData} for the collect fees and rewards transaction.
   */
  data: CollectFeesRewardsData;

}
