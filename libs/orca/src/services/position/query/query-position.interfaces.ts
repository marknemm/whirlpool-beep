import type { Address } from '@coral-xyz/anchor';
import type { WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';

/**
 * Options for getting {@link Position}s.
 *
 * @augments WhirlpoolAccountFetchOptions
 */
export interface GetPositionsOptions extends WhirlpoolAccountFetchOptions {

  /**
   * The {@link Address} of the {@link Whirlpool} to get {@link Position}s for.
   */
  whirlpoolAddress?: Address;

}
