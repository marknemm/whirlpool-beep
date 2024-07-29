import { getWhirlpoolKey } from '@/services/whirlpool/query/query-whirlpool';
import type { CliArgs, CliOpts } from '@/util/cli/cli.interfaces';
import whirlpoolClient from '@/util/whirlpool/whirlpool';
import { type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import deepmerge from 'deepmerge';

const _getWhirlpoolCliOpts = {
  'whirlpool': {
    alias: 'w',
    description: 'Address of the whirlpool',
    group: 'Whirlpool',
    type: 'string' as const,
    conflicts: ['token-a', 'token-b', 'tick-spacing'],
  },
  'token-a': {
    alias: 'a',
    description: 'Token A mint address or symbol',
    group: 'Whirlpool PDA',
    type: 'string' as const,
    implies: ['token-b', 'tick-spacing'],
    conflicts: ['whirlpool'],
  },
  'token-b': {
    alias: 'b',
    description: 'Token B mint address or symbol',
    group: 'Whirlpool PDA',
    type: 'string' as const,
    implies: ['token-a', 'tick-spacing'],
    conflicts: ['whirlpool'],
  },
  'tick-spacing': {
    alias: 't',
    description: 'Tick spacing',
    group: 'Whirlpool PDA',
    type: 'number' as const,
    implies: ['token-a', 'token-b'],
    conflicts: ['whirlpool'],
  },
};

/**
 * Common CLI arguments for getting a whirlpool.
 */
export type GetWhirlpoolCliArgs = CliArgs<typeof _getWhirlpoolCliOpts>;

/**
 * Common CLI options for getting a whirlpool.
 */
export type GetWhirlpoolCliOpts = CliOpts<typeof _getWhirlpoolCliOpts>;

/**
 * Generates the whirlpool options.
 *
 * @param overrides The override options to merge into the default options.
 * @returns The whirlpool options.
 */
export function genGetWhirlpoolCliOpts(overrides: Partial<GetWhirlpoolCliOpts> = {}): typeof _getWhirlpoolCliOpts {
  return deepmerge(_getWhirlpoolCliOpts, overrides);
}

/**
 * Gets the {@link Whirlpool} from the CLI arguments.
 *
 * @param argv The {@link GetWhirlpoolCliArgs}.
 * @returns The {@link Whirlpool}; `undefined` if not provided.
 */
export async function getWhirlpoolFromCliArgs(argv: GetWhirlpoolCliArgs): Promise<Whirlpool | undefined> {
  const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
  return whirlpoolAddress
    ? whirlpoolClient().getPool(whirlpoolAddress)
    : undefined;
}

/**
 * Gets the {@link Whirlpool} address from the CLI arguments.
 *
 * @param argv The {@link GetWhirlpoolCliArgs}.
 * @returns The {@link Whirlpool} {@link PublicKey} address; `undefined` if not provided.
 */
export async function getWhirlpoolAddressFromCliArgs(argv: GetWhirlpoolCliArgs): Promise<PublicKey | undefined> {
  return argv.whirlpool
    ? new PublicKey(argv.whirlpool)
    : (argv.tokenA && argv.tokenB && argv.tickSpacing)
      ? await getWhirlpoolKey({
        tokenA: argv.tokenA,
        tokenB: argv.tokenB,
        tickSpacing: argv.tickSpacing,
      })
      : undefined;
}
