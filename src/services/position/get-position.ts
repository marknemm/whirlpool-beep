import { BundledPosition } from '@/interfaces/position';
import { getPositionBundle } from '@/services/position-bundle/get-position-bundle';
import { info } from '@/util/log';
import whirlpoolClient from '@/util/whirlpool';
import { type Wallet } from '@coral-xyz/anchor';
import { type Address } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Gets a {@link BundledPosition}.
 *
 * @param positionAddress The {@link Address} of the {@link Position} to get.
 * @returns A {@link Promise} that resolves to the {@link BundledPosition}.
 */
export async function getPosition(positionAddress: Address): Promise<BundledPosition> {
  info('Getting bundled position:', positionAddress);

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const occupiedIdxs = PositionBundleUtil.getOccupiedBundleIndexes(positionBundle);
  for (const idx of occupiedIdxs) {
    const positionPda = PDAUtil.getBundledPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionBundle.positionBundleMint,
      idx
    );

    if (positionPda.publicKey.equals(new PublicKey(positionAddress))) {
      const position = await whirlpoolClient().getPosition(positionAddress);
      if (!position) throw new Error('Position not found');

      return {
        bundleIndex: idx,
        position,
        positionBundle
      };
    }
  }

  throw new Error('Position not found');
}

/**
 * Gets a {@link BundledPosition} at a specific `PositionBundle` index.
 *
 * @param bundleIndex The index of the {@link Position} in the `PositionBundle`.
 * @returns A {@link Promise} that resolves to the {@link BundledPosition}.
 */
export async function getPositionAtIdx(bundleIndex: number): Promise<BundledPosition> {
  info('Getting bundled position at index:', bundleIndex);

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const positionPda = PDAUtil.getBundledPosition(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint,
    bundleIndex
  );

  const position = await whirlpoolClient().getPosition(positionPda.publicKey);
  if (!position) throw new Error('Position not found');

  return {
    bundleIndex,
    position,
    positionBundle
  };
}

/**
 * Get all {@link BundledPosition}s in the `PositionBundle` associated with the {@link Wallet}.
 *
 * @param whirlpoolAddress The {@link PublicKey} address of the {@link Whirlpool} to get the {@link Position}s for.
 * If not provided, all {@link Position}s in the `PositionBundle` will be returned.
 * @returns A {@link Promise} that resolves to an array of {@link BundledPosition}s.
 */
export async function getPositions(whirlpoolAddress?: Address): Promise<BundledPosition[]> {
  whirlpoolAddress
    ? info('Getting all bundled positions in whirlpool:', whirlpoolAddress)
    : info('Getting all bundled positions...');

  const positions: BundledPosition[] = [];

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const occupiedIdxs = PositionBundleUtil.getOccupiedBundleIndexes(positionBundle);
  for (const idx of occupiedIdxs) {
    const positionPda = PDAUtil.getBundledPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionBundle.positionBundleMint,
      idx
    );

    const position = await whirlpoolClient().getPosition(positionPda.publicKey);
    if (position && (!whirlpoolAddress || new PublicKey(whirlpoolAddress).equals(position.getData().whirlpool))) {
      positions.push({
        bundleIndex: idx,
        position,
        positionBundle
      });
    }
  }

  return positions;
}
