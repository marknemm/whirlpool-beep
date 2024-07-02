import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { getTokenMetaPair } from '@/services/token/get-token';
import { debug } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool';
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
  const [tokenAMeta, tokenBMeta] = await getTokenMetaPair(tokenAddrA, tokenAddrB);

  const initialTick = PriceMath.priceToTickIndex(
    initialPrice,
    tokenAMeta.decimals,
    tokenBMeta.decimals
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
  debug('Whirlpool created with address:', poolKey);

  return whirlpoolClient().getPool(poolKey);
}
