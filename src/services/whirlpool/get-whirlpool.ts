import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { debug, info } from '@/util/log';
import whirlpoolClient, { type WhirlpoolArgs } from '@/util/whirlpool';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param args The {@link WhirlpoolArgs arguments} to derive the PDA for the Whirlpool.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(args: WhirlpoolArgs): Promise<Whirlpool> {
  debug('Whirlpool args:', args);

  const whirlpoolPDA = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    new PublicKey(args.tokenAMeta.address),
    new PublicKey(args.tokenBMeta.address),
    args.tickSpacing
  );

  const whirlpool = await whirlpoolClient().getPool(whirlpoolPDA.publicKey);
  info('Retrieved whirlpool with public key:', whirlpool.getAddress().toBase58());

  return whirlpool;
}
