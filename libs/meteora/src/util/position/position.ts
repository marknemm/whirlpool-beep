import { Address } from '@coral-xyz/anchor';
import DLMM from '@meteora-ag/dlmm';
import { debug, type Null } from '@npc/core';
import { formatPool, getPool } from '@npc/meteora/util/pool/pool';
import { isAddress, rpc, toPubKeyStr, wallet } from '@npc/solana';
import { PublicKey } from '@solana/web3.js';
import { GetPositionOpts, GetPositionsOpts, Position } from './position.interfaces';

const _poolPositionCache = new Map<string, Position[]>();
const _positionCache = new Map<string, Position>();

/**
 * Formats a {@link Position} into a log string.
 *
 * @param position The {@link Position} to format.
 * @param includePool Whether to include the whirlpool data in the log string.
 * @returns A {@link Promise} that resolves to the formatted log string.
 */
export async function formatPosition(
  position: Position | Address | Null,
  includePool = false
): Promise<string> {
  if (!position) return '';

  position = await resolvePosition(position);

  const pool = await getPool({ poolAddress: position.poolPublicKey });

  return includePool
    ? `${position?.publicKey.toBase58()} ---- ${await formatPool(pool)}`
    : position?.publicKey.toBase58();
}

/**
 * Gets a Meteora {@link Position}.
 *
 * @param positionAddress The {@link Address} of the {@link Position} to get.
 * @param opts The {@link GetPositionOpts} to use for fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link Position}.
 */
export async function getPosition(positionAddress: Address, opts?: GetPositionOpts): Promise<Position | undefined> {
  positionAddress = toPubKeyStr(positionAddress);

  if (opts?.ignoreCache || !_positionCache.has(positionAddress)) {
    await _refreshPositionCache();
  }

  return _positionCache.get(positionAddress);
}

/**
 * Get all {@link Position}s associated with the {@link Wallet}.
 *
 * @param args The {@link GetPositionsOpts} to use for fetching the {@link Position}s.
 * @returns A {@link Promise} that resolves to an array of {@link BundledPosition}s.
 */
export async function getPositions(args: GetPositionsOpts = {}): Promise<Position[]> {
  const { poolAddress } = args;

  poolAddress
    ? debug('Getting all Meteora Positions in pool:', poolAddress)
    : debug('Getting all Meteora Positions...');

  await _refreshPositionCache();

  const positions = poolAddress
    ? await _poolPositionCache.get(toPubKeyStr(poolAddress)) || []
    : await Array.from(_positionCache.values());

  return positions;
}

/**
 * Resolves a {@link Position} or {@link Address} to a {@link Position}.
 *
 * @param position The {@link Position} or {@link Address} to resolve.
 * @param opts The {@link GetPositionOpts} to use for fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link Position}.
 */
export async function resolvePosition(position: Position | Address, opts?: GetPositionOpts): Promise<Position> {
  if (!isAddress(position)) {
    return position;
  }

  const queriedPosition = await getPosition(position, opts);
  if (!queriedPosition) throw new Error(`Position not found: ${toPubKeyStr(position)}`);
  return queriedPosition;
}

/**
 * Refreshes the Meteora {@link Position} caches.
 */
async function _refreshPositionCache() {
  _positionCache.clear();
  _poolPositionCache.clear();

  // Query on-chain positions
  const poolIndexedPositions = await DLMM.getAllLbPairPositionsByUser(rpc(), wallet().publicKey);

  // Fill pool (grouped) position cache
  for (const [poolAddress, positionInfo] of poolIndexedPositions.entries()) {
    _poolPositionCache.set(poolAddress, positionInfo.lbPairPositionsData.map((position) => ({
      ...position,
      poolPublicKey: new PublicKey(poolAddress),
    })));

    // Fill individual position cache
    for (const position of positionInfo.lbPairPositionsData) {
      _positionCache.set(position.publicKey.toBase58(), {
        ...position,
        poolPublicKey: new PublicKey(poolAddress),
      });
    }
  }
}

export type * from './position.interfaces';
