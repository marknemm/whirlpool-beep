import DLMM, { deriveLbPair2 } from '@meteora-ag/dlmm';
import { numericToBN } from '@npc/core';
import { METEORA_PROGRAM_ID } from '@npc/meteora/constants/meteora';
import { getTokenPair, rpc, toPubKey } from '@npc/solana';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type { GetPoolArgs, GetPoolKeyArgs } from './query-pool.interfaces';

/**
 * Cache for previously fetched Meteora liquidity pools indexed by pool address.
 */
const _poolCache = new Map<string, DLMM>();

/**
 * Gets and caches a Meteora liquidity pool.
 *
 * @param args The {@link GetPoolArgs} to use for fetching the pool.
 * @returns A {@link Promise} that resolves to the fetched {@link DLMM} pool.
 */
export async function getPool(args: GetPoolArgs): Promise<DLMM> {
  const { baseFee, binStep, ignoreCache, poolAddress, tokenA, tokenB } = args;

  // Verify args
  if (!poolAddress && !(tokenA && tokenB && baseFee && binStep)) {
    throw new Error('Must provide either a pool address or token A, token B, base fee, and bin step args.');
  }

  // Get pool key
  const poolKey = poolAddress
    ? toPubKey(poolAddress)
    : await getPoolKey(args as GetPoolKeyArgs);

  // Get pool
  const pool = (!ignoreCache && _poolCache.has(poolKey.toBase58()))
    ? _poolCache.get(poolKey.toBase58())!
    : await DLMM.create(rpc(), poolKey);

  // Cache and return pool
  _poolCache.set(poolKey.toBase58(), pool);
  return pool;
}

/**
 * Gets the {@link PublicKey} (address) for a Meteora liquidity pool.
 *
 * @param args The {@link GetPoolArgs} to use for fetching the pool key.
 * @returns A {@link Promise} that resolves to the {@link PublicKey} (address) of the Meteora liquidity pool.
 */
export async function getPoolKey(args: GetPoolKeyArgs): Promise<PublicKey> {
  const { baseFee, binStep, tokenA: tokenQueryA, tokenB: tokenQueryB } = args;

  // Get mint pair ID for the pool in format <mintA>-<mintB> where mints are sorted
  const [tokenA, tokenB] = await getTokenPair(tokenQueryA, tokenQueryB);

  // Calculate base factor
  const baseFactor = numericToBN(baseFee, tokenB.mint.decimals).divn(binStep);

  // Derive pool key via PDA
  return deriveLbPair2(
    new PublicKey(tokenA.publicKey),
    new PublicKey(tokenB.publicKey),
    new BN(binStep),
    baseFactor,
    METEORA_PROGRAM_ID
  )[0];
}

export type * from './query-pool.interfaces';
