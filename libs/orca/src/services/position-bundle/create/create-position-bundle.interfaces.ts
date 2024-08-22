import type { Address } from '@coral-xyz/anchor';
import type { InstructionData } from '@npc/solana';
import type { PDA } from '@orca-so/common-sdk';
import type { Keypair } from '@solana/web3.js';

/**
 * Instruction data for creating a position bundle.
 */
export interface CreatePositionBundleIxData extends InstructionData {

  /**
   * The {@link Address} of the owner of the position bundle.
   */
  owner: Address;

  /**
   * The {@link PDA} for the position bundle metadata account.
   */
  positionBundleMetadataPda: PDA;

  /**
   * The {@link Keypair} for the position bundle mint account.
   */
  positionBundleMintKeypair: Keypair;

  /**
   * The {@link PDA} for the position bundle account.
   */
  positionBundlePda: PDA;

  /**
   * The {@link Address} of the position bundle token account.
   */
  positionBundleTokenAccount: Address;

}
