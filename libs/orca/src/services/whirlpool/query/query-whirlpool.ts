import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@npc/orca/constants/whirlpool';
import OrcaWhirlpoolDAO from '@npc/orca/data/orca-whirlpool/orca-whirlpool.dao';
import whirlpoolClient from '@npc/orca/util/whirlpool/whirlpool';
import { getTokenPair } from '@npc/solana';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type { GetWhirlpoolArgs, GetWhirlpoolKeyArgs } from './query-whirlpool.interfaces';

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param args The {@link GetWhirlpoolArgs} to use when fetching the {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(args: GetWhirlpoolArgs): Promise<Whirlpool> {
  const { tickSpacing, tokenA, tokenB, whirlpoolAddress } = args;

  if (!whirlpoolAddress && !(tokenA && tokenB && tickSpacing)) {
    throw new Error('Must provide either a whirlpool address or token A, token B, and tick spacing.');
  }

  const whirlpoolKey = whirlpoolAddress ?? await getWhirlpoolKey(args as GetWhirlpoolKeyArgs);

  const whirlpool = await whirlpoolClient().getPool(whirlpoolKey, args);
  await OrcaWhirlpoolDAO.insert(whirlpool, { catchErrors: true });

  return whirlpool;
}

/**
 * Gets the {@link PublicKey} (address) for a {@link Whirlpool} via PDA.
 *
 * @param args The {@link WhirlpoolPDAOpts} to use when fetching the {@link Whirlpool} key.
 * @returns The {@link PublicKey} (address) of the {@link Whirlpool}.
 */
export async function getWhirlpoolKey(args: GetWhirlpoolKeyArgs): Promise<PublicKey> {
  const { tokenA, tokenB, tickSpacing } = args;
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
