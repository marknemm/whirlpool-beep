import { type Address } from '@coral-xyz/anchor';
import DLMM from '@meteora-ag/dlmm';
import { info } from '@npc/core';
import { Position } from '@npc/meteora/interfaces/position';
import { rpc, toPubKeyStr, wallet } from '@npc/solana';
import { PublicKey } from '@solana/web3.js';
import { GetPositionOptions, GetPositionsOptions } from './query-position.interfaces';

const _poolPositionCache = new Map<string, Position[]>();
const _positionCache = new Map<string, Position>();

/**
 * Gets a Meteora {@link Position}.
 *
 * @param positionAddress The {@link Address} of the {@link Position} to get.
 * @param opts The {@link GetPositionOptions} to use when fetching the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link Position}.
 */
export async function getPosition(
  positionAddress: Address,
  opts?: GetPositionOptions
): Promise<Position | undefined> {
  positionAddress = toPubKeyStr(positionAddress);

  if (opts?.ignoreCache || !_positionCache.has(positionAddress)) {
    await _refreshPositionCache();
  }

  return _positionCache.get(positionAddress);
}

/**
 * Get all {@link Position}s associated with the {@link Wallet}.
 *
 * @param opts The {@link GetPositionsOptions} to use when fetching the {@link Position}s.
 * @returns A {@link Promise} that resolves to an array of {@link BundledPosition}s.
 */
export async function getPositions({
  poolAddress,
}: GetPositionsOptions): Promise<Position[]> {
  poolAddress
    ? info('Getting all Meteora Positions in pool:', poolAddress)
    : info('Getting all Meteora Positions...');

  await _refreshPositionCache();

  const positions = poolAddress
    ? await _poolPositionCache.get(toPubKeyStr(poolAddress)) || []
    : await Array.from(_positionCache.values());

  return positions;
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

export type * from './query-position.interfaces';
