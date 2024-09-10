import { Address } from '@coral-xyz/anchor';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import DLMM, { deriveLbPair2 } from '@meteora-ag/dlmm';
import { invertPrice, toBN, type Null } from '@npc/core';
import { METEORA_PROGRAM_ID } from '@npc/meteora/constants/meteora';
import { getTokenPair, rpc, toPubKey } from '@npc/solana';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';
import type { GetPoolArgs, GetPoolKeyArgs, ResolvePoolOptions } from './pool.interfaces';

/**
 * Cache for previously fetched Meteora liquidity pools indexed by pool address.
 */
const _poolCache = new Map<string, DLMM>();

/**
 * Formats a {@link DLMM} pool into a human-readable log ID.
 *
 * @param pool The Meteora {@link DLMM} pool, or the {@link Address} of a {@link DLMM} pool to format.
 * @returns A {@link Promise} that resolves to the formatted log ID. Returns an empty string if the pool is `null`.
 */
export async function formatPool(pool: DLMM | Address | Null): Promise<string> {
  if (!pool) return '';

  pool = await resolvePool(pool);

  const [tokenX, tokenY] = await getPoolTokenPair(pool);
  const address = pool.pubkey.toBase58() ?? '';

  return `${address} -- ${tokenX.metadata.symbol} / ${tokenY.metadata.symbol} / ${pool.lbPair.binStep}`.trim();
}

/**
 * Gets and caches a Meteora liquidity pool.
 *
 * @param args The {@link GetPoolArgs} to use for fetching the pool.
 * @returns A {@link Promise} that resolves to the fetched {@link DLMM} pool.
 */
export async function getPool(args: GetPoolArgs): Promise<DLMM> {
  const { baseFee, binStep, ignoreCache, poolAddress, tokenX, tokenY } = args;

  // Verify args
  if (!poolAddress && !(tokenX && tokenY && baseFee && binStep)) {
    throw new Error('Must provide either a pool address or token X, token Y, base fee, and bin step args.');
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
  const { baseFee, binStep, tokenX: tokenQueryX, tokenY: tokenQueryY } = args;

  // Get mint pair ID for the pool in format <mintA>-<mintB> where mints are sorted
  const [tokenX, tokenY] = await getTokenPair(tokenQueryX, tokenQueryY);

  // Calculate base factor
  const baseFactor = toBN(baseFee, 6).divn(binStep);

  // Derive pool key via PDA
  return deriveLbPair2(
    new PublicKey(tokenX.publicKey),
    new PublicKey(tokenY.publicKey),
    toBN(binStep),
    baseFactor,
    METEORA_PROGRAM_ID
  )[0];
}

/**
 * Gets the price of a given {@link DLMM} pool.
 *
 * The price is the value of token X in terms of token Y.
 *
 * @param pool The Meteora {@link DLMM} pool to get the price of.
 * @returns The {@link Decimal} price of the {@link Whirlpool}.
 */
export async function getPoolPrice(pool: DLMM): Promise<Decimal> {
  const activeBin = await pool.getActiveBin();
  return invertPrice(activeBin.pricePerToken);
}

/**
 * Gets the tokens of a given Meteora {@link DLMM} pool.
 *
 * @param pool The Meteora {@link DLMM} pool or {@link Address} of the {@link DLMM} pool to get the tokens of.
 * @returns A {@link Promise} that resolves to an array filled with a pair of token {@link DigitalAsset}s.
 */
export async function getPoolTokenPair(pool: DLMM | Address): Promise<[DigitalAsset, DigitalAsset]> {
  pool = await resolvePool(pool);

  const tokenAddressA = pool.tokenX.publicKey;
  const tokenAddressB = pool.tokenY.publicKey;

  return getTokenPair(tokenAddressA, tokenAddressB);
}

/**
 * Resolves a Meteora {@link DLMM} pool or {@link Address} to a {@link DLMM} pool.
 *
 * @param pool The Meteora {@link DLMM} pool or {@link Address} of the {@link DLMM} pool to resolve.
 * @param opts The {@link ResolvePoolOptions} to use for resolving the pool.
 * @returns A {@link Promise} that resolves to the {@link DLMM} pool.
 */
export async function resolvePool(pool: DLMM | Address, opts?: ResolvePoolOptions): Promise<DLMM> {
  return (pool instanceof DLMM)
    ? pool
    : getPool({
      poolAddress: pool,
      ignoreCache: opts?.ignoreCache
    });
}

export type * from './pool.interfaces';
