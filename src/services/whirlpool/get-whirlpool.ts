import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { debug, info } from '@/util/log';
import whirlpoolClient from '@/util/whirlpool-client';
import { type Address } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param tokenA The token A {@link Address}.
 * @param tokenB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(tokenA: Address, tokenB: Address, tickSpacing: number): Promise<Whirlpool> {
  debug('Whirlpool args:', { tokenA, tokenB, tickSpacing });

  const whirlpoolPDA = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    new PublicKey(tokenA),
    new PublicKey(tokenB),
    tickSpacing
  );

  const whirlpool = await whirlpoolClient().getPool(whirlpoolPDA.publicKey);
  info('Retrieved whirlpool with public key:', whirlpool.getAddress().toBase58());

  return whirlpool;
}
