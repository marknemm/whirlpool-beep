import type { Address } from '@coral-xyz/anchor';
import type { Position, PositionBundleData, WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';

/**
 * A bundled {@link Position}.
 */
export interface BundledPosition {

  /**
   * The index of the {@link Position} in the {@link PositionBundleData}.
   */
  bundleIndex: number;

  /**
   * The {@link Position} itself.
   */
  position: Position;

  /**
   * The {@link PositionBundleData} containing the {@link Position}.
   */
  positionBundle: PositionBundleData;

}

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
