import { type Null } from '@npc/core';
import type { BundledPosition } from '@npc/orca/interfaces/position.interfaces';
import { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Formats a {@link Position} or {@link BundledPosition} into a log string.
 *
 * @param position The {@link Position} or {@link BundledPosition} to format.
 * @param includeWhirlpool Whether to include the whirlpool data in the log string.
 * @returns A {@link Promise} that resolves to the formatted log string.
 */
export async function formatPosition(
  position: BundledPosition | Position | Null,
  includeWhirlpool = false
): Promise<string> {
  if (!position) return '';

  const bundledPosition = Object.hasOwn(position, 'position')
    ? position as BundledPosition
    : undefined;

  position = bundledPosition
    ? bundledPosition.position
    : position as Position;

  const whirlpoolData = (position as Position).getWhirlpoolData();

  return includeWhirlpool
    ? `${position.getAddress().toBase58()} ---- ${await formatWhirlpool(whirlpoolData)}`
    : position.getAddress().toBase58();
}
