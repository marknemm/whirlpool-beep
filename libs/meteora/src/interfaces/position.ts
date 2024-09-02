import { LbPosition } from '@meteora-ag/dlmm';
import { PublicKey } from '@solana/web3.js';

/**
 * A position in a Meteora liquidity pool.
 *
 * @augments LbPosition
 */
export interface Position extends LbPosition {

  /**
   * The {@link PublicKey} of the Meteora pool that the position is in.
   */
  poolPublicKey: PublicKey;

}
