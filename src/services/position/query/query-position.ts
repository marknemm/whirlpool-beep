import type { BundledPosition } from '@/interfaces/position.interfaces';
import { getPositionBundle } from '@/services/position-bundle/query/query-position-bundle';
import { info } from '@/util/log/log';
import whirlpoolClient from '@/util/whirlpool/whirlpool';
import { type Wallet } from '@coral-xyz/anchor';
import { type Address } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleUtil, WhirlpoolAccountFetchOptions, type Position } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type { GetPositionsOptions } from './query-position.interfaces';

/**
 * Gets a {@link BundledPosition}.
 *
 * @param positionAddress The {@link Address} of the {@link Position} to get.
 * @param opts The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link BundledPosition}.
 */
export async function getPosition(
  positionAddress: Address,
  opts?: WhirlpoolAccountFetchOptions
): Promise<BundledPosition> {
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
      const position = await whirlpoolClient().getPosition(positionAddress, opts);
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
 * @param opts The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link BundledPosition}.
 */
export async function getPositionAtIdx(
  bundleIndex: number,
  opts?: WhirlpoolAccountFetchOptions
): Promise<BundledPosition> {
  info('Getting bundled position at index:', bundleIndex);

  const positionBundle = await getPositionBundle();
  if (!positionBundle) throw new Error('Position bundle not available');

  const positionPda = PDAUtil.getBundledPosition(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint,
    bundleIndex
  );

  const position = await whirlpoolClient().getPosition(positionPda.publicKey, opts);
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
 * @param opts The {@link GetPositionsOptions} to use when fetching the {@link Position}s.
 * @returns A {@link Promise} that resolves to an array of {@link BundledPosition}s.
 */
export async function getPositions({
  whirlpoolAddress,
  ...whirlpoolAccountFetchOptions
}: GetPositionsOptions): Promise<BundledPosition[]> {
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

    const position = await whirlpoolClient().getPosition(positionPda.publicKey, whirlpoolAccountFetchOptions);
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

export type * from './query-position.interfaces';
