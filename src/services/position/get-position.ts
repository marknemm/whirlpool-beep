import { getPositionBundle } from '@/services/position/get-position-bundle';
import whirlpoolClient from '@/util/whirlpool-client';
import { type Wallet } from '@coral-xyz/anchor';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * Get all {@link Position}s in the `PositionBundle` associated with the {@link Wallet}.
 *
 * @param whirlpool The {@link Whirlpool} to get the {@link Position}s for.
 * If not provided, all {@link Position}s in the `PositionBundle` will be returned.
 * @returns A {@link Promise} that resolves to an array of {@link Position}s.
 */
export async function getPositions(whirlpool?: Whirlpool): Promise<Position[]> {
  const positions: Position[] = [];

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
    if (position && (!whirlpool || whirlpool.getAddress().equals(position.getData().whirlpool))) {
      positions.push(position);
    }
  }

  return positions;
}
