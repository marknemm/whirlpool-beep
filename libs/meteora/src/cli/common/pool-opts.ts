import type DLMM from '@meteora-ag/dlmm';
import type { CliArgs, CliOpts } from '@npc/core';
import { getPool, getPoolKey } from '@npc/meteora/util/pool/pool';
import { PublicKey } from '@solana/web3.js';
import deepmerge from 'deepmerge';

const _getPoolCliOpts = {
  'pool': {
    alias: 'w',
    description: 'Address of the Meteora DLMM pool',
    group: 'Pool',
    type: 'string' as const,
    conflicts: ['token-x', 'token-y', 'bin-step'],
  },
  'token-x': {
    alias: 'a',
    description: 'Token X mint address or symbol',
    group: 'Pool PDA',
    type: 'string' as const,
    implies: ['token-y', 'bin-step'],
    conflicts: ['pool'],
  },
  'token-y': {
    alias: 'b',
    description: 'Token Y mint address or symbol',
    group: 'Pool PDA',
    type: 'string' as const,
    implies: ['token-x', 'bin-step'],
    conflicts: ['pool'],
  },
  'bin-step': {
    alias: 's',
    description: 'Bin Step',
    group: 'Pool PDA',
    type: 'number' as const,
    implies: ['token-x', 'token-y', 'base-fee'],
    conflicts: ['pool'],
  },
  'base-fee': {
    alias: 'fee',
    description: 'Base Fee',
    group: 'Pool PDA',
    type: 'number' as const,
    implies: ['token-x', 'token-y', 'bin-step'],
    conflicts: ['pool'],
  },
};

/**
 * Common CLI arguments for getting a Meteora DLMM pool.
 */
export type GetPoolCliArgs = CliArgs<typeof _getPoolCliOpts>;

/**
 * Common CLI options for getting a Meteora DLMM pool.
 */
export type GetPoolCliOpts = CliOpts<typeof _getPoolCliOpts>;

/**
 * Generates the {@link GetPoolCliOpts}.
 *
 * @param overrides The override options to merge into the default options.
 * @returns The {@link GetPoolCliOpts}.
 */
export function genGetPoolCliOpts(overrides: Partial<GetPoolCliOpts> = {}): typeof _getPoolCliOpts {
  return deepmerge(_getPoolCliOpts, overrides);
}

/**
 * Gets the Meteora {@link DLMM} pool from the CLI arguments.
 *
 * @param argv The {@link GetPoolCliArgs}.
 * @returns The Meteora {@link DLMM} pool; `undefined` if not provided.
 */
export async function getPoolFromCliArgs(argv: GetPoolCliArgs): Promise<DLMM | undefined> {
  const poolAddress = await getPoolAddressFromCliArgs(argv);
  return poolAddress
    ? getPool({ poolAddress })
    : undefined;
}

/**
 * Gets the Meteora {@link DLMM} pool address from the CLI arguments.
 *
 * @param argv The {@link GetPoolCliArgs}.
 * @returns The {@link DLMM} pool {@link PublicKey} address; `undefined` if not provided.
 */
export async function getPoolAddressFromCliArgs(argv: GetPoolCliArgs): Promise<PublicKey | undefined> {
  return argv.pool
    ? new PublicKey(argv.pool)
    : (argv.tokenA && argv.tokenB && argv.tickSpacing)
      ? await getPoolKey({
        tokenX: argv.tokenX!,
        tokenY: argv.tokenY!,
        binStep: argv.binStep!,
        baseFee: argv.baseFee!,
      })
      : undefined;
}
