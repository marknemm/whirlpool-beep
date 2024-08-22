import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@npc/orca/constants/whirlpool';
import OrcaWhirlpoolDAO from '@npc/orca/data/orca-whirlpool/orca-whirlpool.dao';
import whirlpoolClient from '@npc/orca/util/whirlpool/whirlpool';
import { getTokenPair } from '@npc/solana';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type { GetWhirlpoolKeyOpts, GetWhirlpoolOpts } from './query-whirlpool.interfaces';

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param opts The {@link GetWhirlpoolOpts} to use when fetching the {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(opts: GetWhirlpoolOpts): Promise<Whirlpool> {
  if (!opts.whirlpoolAddress && !opts.tokenA && !opts.tokenB && !opts.tickSpacing) {
    throw new Error('Must provide either a whirlpool address or token A, token B, and tick spacing.');
  }

  const whirlpoolKey = opts.whirlpoolAddress ?? await getWhirlpoolKey(opts as GetWhirlpoolKeyOpts);

  const whirlpool = await whirlpoolClient().getPool(whirlpoolKey, opts);
  await OrcaWhirlpoolDAO.insert(whirlpool, { catchErrors: true });

  return whirlpool;
}

/**
 * Gets the {@link PublicKey} (address) for a {@link Whirlpool} via PDA.
 *
 * @param opts The {@link WhirlpoolPDAOpts} to use when fetching the {@link Whirlpool} key.
 * @returns The {@link PublicKey} (address) of the {@link Whirlpool}.
 */
export async function getWhirlpoolKey(opts: GetWhirlpoolKeyOpts): Promise<PublicKey> {
  const { tokenA, tokenB, tickSpacing } = opts;
  const [{ mint: mintA }, { mint: mintB }] = await getTokenPair(tokenA, tokenB);

  return PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    new PublicKey(mintA.publicKey),
    new PublicKey(mintB.publicKey),
    tickSpacing
  ).publicKey;
}

export type * from './query-whirlpool.interfaces';
