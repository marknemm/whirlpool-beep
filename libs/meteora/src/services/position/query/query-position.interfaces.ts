import type { Address } from '@coral-xyz/anchor';
import type DLMM from '@meteora-ag/dlmm';
import type { LbPosition } from '@meteora-ag/dlmm';

/**
 * Options for getting an {@link LbPosition}.
 */
export interface GetPositionOptions {

  /**
   * Whether to ignore the cache and fetch the {@link LbPosition} from the blockchain.
   *
   * @default false
   */
  ignoreCache?: boolean;

}

/**
 * Options for getting {@link LbPosition}s.
 */
export interface GetPositionsOptions {

  /**
   * The {@link Address} of the {@link DLMM} pool to get {@link LbPosition}s for.
   */
  poolAddress?: Address;

}
