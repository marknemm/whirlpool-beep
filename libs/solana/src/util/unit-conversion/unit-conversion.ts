import type { Null } from '@npc/core';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const MICRO_LAMPORTS_PER_LAMPORT = 10e6;

/**
 * Converts a given amount of either `SOL` (default) or `Micro Lamports` to `Lamports`.
 *
 * @param amt The amount to convert.
 * @param unit The unit of the amount. Defaults to `SOL`.
 * @returns The amount of `Lamports`.
 */
export function toLamports(amt: number | Null, unit: 'SOL' | 'Micro Lamports' = 'SOL'): number {
  if (!amt) return 0;

  return unit === 'SOL'
    ? amt * LAMPORTS_PER_SOL
    : amt / MICRO_LAMPORTS_PER_LAMPORT;
}

/**
 * Converts a given amount of either `SOL` (default) or `Lamports` to `Micro Lamports`.
 *
 * @param amt The amount to convert.
 * @param unit The unit of the amount. Defaults to `SOL`.
 * @returns The converted amount in `Micro Lamports`.
 */
export function toMicroLamports(amt: number | Null, unit: 'SOL' | 'Lamports' = 'SOL'): number {
  if (!amt) return 0;

  return unit === 'SOL'
    ? toLamports(amt) * MICRO_LAMPORTS_PER_LAMPORT
    : amt * MICRO_LAMPORTS_PER_LAMPORT;
}

/**
 * Converts a given amount of either `Lamports` (default) or `Micro Lamports` to `SOL`.
 *
 * @param amt The amount to convert.
 * @param unit The unit of the amount. Defaults to `Lamports`.
 * @returns The amount of `SOL`.
 */
export function toSol(amt: number | Null, unit: 'Lamports' | 'Micro Lamports' = 'Lamports'): number {
  if (!amt) return 0;

  return unit === 'Lamports'
    ? amt / LAMPORTS_PER_SOL
    : toLamports(amt, 'Micro Lamports') / LAMPORTS_PER_SOL;
}
