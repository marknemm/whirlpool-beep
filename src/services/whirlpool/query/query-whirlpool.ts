import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import WhirlpoolDAO from '@/data/whirlpool/whirlpool.dao';
import { getTokenPair } from '@/util/token/token';
import whirlpoolClient from '@/util/whirlpool/whirlpool';
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
  const whirlpoolKey = opts.whirlpoolAddress ?? await getWhirlpoolKey(opts);

  const whirlpool = await whirlpoolClient().getPool(whirlpoolKey, opts);
  await WhirlpoolDAO.insert(whirlpool, { catchErrors: true });

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
