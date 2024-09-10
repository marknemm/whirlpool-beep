import type { Address } from '@coral-xyz/anchor';
import type { LbPosition } from '@meteora-ag/dlmm';
import type { PublicKey } from '@solana/web3.js';

/**
 * Options for getting an {@link Position}.
 */
export interface GetPositionOpts {

  /**
   * Whether to ignore the cache and fetch the {@link Position} from the blockchain.
   *
   * @default false
   */
  ignoreCache?: boolean;

}

/**
 * Options for getting {@link Position}s.
 */
export interface GetPositionsOpts {

  /**
   * The {@link Address} of the {@link DLMM} pool to get {@link Position}s for.
   */
  poolAddress?: Address;

}

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
