import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import type DLMM from '@meteora-ag/dlmm';
import { invertPrice, type Null } from '@npc/core';
import { getTokenPair } from '@npc/solana';
import Decimal from 'decimal.js';

/**
 * Gets the price of a given {@link DLMM} pool.
 *
 * The price is the value of token X in terms of token Y.
 *
 * @param pool The {@link DLMM} pool to get the price of.
 * @returns The {@link Decimal} price of the {@link Whirlpool}.
 */
export async function getPoolPrice(pool: DLMM): Promise<Decimal> {
  const activeBin = await pool.getActiveBin();
  return invertPrice(activeBin.pricePerToken);
}

/**
 * Gets the tokens of a given Meteora {@link DLMM} pool.
 *
 * @param pool The Meteora {@link DLMM} pool to get the tokens of.
 * @returns A {@link Promise} that resolves to an array filled with a pair of token {@link DigitalAsset}s.
 */
export async function getPoolTokenPair(pool: DLMM): Promise<[DigitalAsset, DigitalAsset]> {
  const tokenAddressA = pool.tokenX.publicKey;
  const tokenAddressB = pool.tokenY.publicKey;

  return getTokenPair(tokenAddressA, tokenAddressB);
}

/**
 * Formats a {@link DLMM} pool into a human-readable log ID.
 *
 * @param pool The {@link DLMM} pool to format.
 * @returns A {@link Promise} that resolves to the formatted log ID. Returns an empty string if the pool is `null`.
 */
export async function formatPool(pool: DLMM | Null): Promise<string> {
  if (!pool) return '';

  const [tokenX, tokenY] = await getPoolTokenPair(pool);
  const address = pool.pubkey.toBase58() ?? '';

  return `${address} -- ${tokenX.metadata.symbol} / ${tokenY.metadata.symbol} / ${pool.lbPair.binStep}`.trim();
}
