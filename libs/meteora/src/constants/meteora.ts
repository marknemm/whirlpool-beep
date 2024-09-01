import { LBCLMM_PROGRAM_IDS } from '@meteora-ag/dlmm';
import env from '@npc/meteora/util/env/env';
import { PublicKey } from '@solana/web3.js';

/**
 * The Meteora program ID.
 */
export const METEORA_PROGRAM_ID = new PublicKey(
  LBCLMM_PROGRAM_IDS[
    env.NODE_ENV === 'production'
      ? 'mainnet-beta'
      : 'devnet'
  ]
);
