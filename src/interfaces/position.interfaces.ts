import type { Position, PositionBundleData } from '@orca-so/whirlpools-sdk';

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
