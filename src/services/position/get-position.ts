import { BundledPosition } from '@/interfaces/position';
import { getPositionBundle } from '@/services/position-bundle/get-position-bundle';
import whirlpoolClient from '@/util/whirlpool-client';
import { type Wallet } from '@coral-xyz/anchor';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Get all {@link Position}s in the `PositionBundle` associated with the {@link Wallet}.
 *
 * @param whirlpoolAddress The {@link PublicKey} address of the {@link Whirlpool} to get the {@link Position}s for.
 * If not provided, all {@link Position}s in the `PositionBundle` will be returned.
 * @returns A {@link Promise} that resolves to an array of {@link Position}s.
 */
export async function getPositions(whirlpoolAddress?: PublicKey): Promise<Position[]> {
  const bundledPositions = await getBundledPositions(whirlpoolAddress);
  return bundledPositions.map((bundledPosition) => bundledPosition.position);
}

/**
 * Get all {@link BundledPosition}s in the `PositionBundle` associated with the {@link Wallet}.
 *
 * @param whirlpoolAddress The {@link PublicKey} address of the {@link Whirlpool} to get the {@link Position}s for.
 * If not provided, all {@link Position}s in the `PositionBundle` will be returned.
 * @returns A {@link Promise} that resolves to an array of {@link BundledPosition}s.
 */
export async function getBundledPositions(whirlpoolAddress?: PublicKey): Promise<BundledPosition[]> {
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
    if (position && (!whirlpoolAddress || whirlpoolAddress.equals(position.getData().whirlpool))) {
      positions.push({
        bundleIndex: idx,
        position,
        positionBundle
      });
    }
  }

  return positions;
}
