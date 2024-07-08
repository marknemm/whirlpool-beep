import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { getTokenPair } from '@/util/token';
import { debug } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool';
import { type Address } from '@orca-so/common-sdk';
import { PriceMath, Whirlpool } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Creates a {@link Whirlpool}.
 *
 * @param tokenAddrA The token A {@link Address}.
 * @param tokenAddrB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @param initialPrice The initial price of token A in terms of token B.
 * @returns A {@link Promise} that resolves to the newly created {@link Whirlpool}.
 * @throws An {@link Error} if {@link Whirlpool} creation fails to complete.
 */
export async function createWhirlpool(
  tokenAddrA: Address,
  tokenAddrB: Address,
  tickSpacing: number,
  initialPrice: Decimal
): Promise<Whirlpool> {
  const [tokenA, tokenB] = await getTokenPair(tokenAddrA, tokenAddrB);

  const initialTick = PriceMath.priceToTickIndex(
    initialPrice,
    tokenA.mint.decimals,
    tokenB.mint.decimals
  );

  const { poolKey, tx } = await whirlpoolClient().createPool(
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    tokenAddrA,
    tokenAddrB,
    tickSpacing,
    initialTick,
    whirlpoolClient().getContext().wallet.publicKey
  );

  debug('Creating whirlpool...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  const whirlpool = await whirlpoolClient().getPool(poolKey);
  debug('Created whirlpool:', formatWhirlpool(whirlpool));

  return whirlpool;
}
