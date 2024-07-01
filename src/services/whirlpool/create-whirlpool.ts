import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { debug } from '@/util/log';
import whirlpoolClient, { sendTx, type WhirlpoolCreateArgs } from '@/util/whirlpool';
import { PriceMath, Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * Creates a {@link Whirlpool}.
 *
 * @param whirlpoolArgs The {@link WhirlpoolCreateArgs} for the new {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the newly created {@link Whirlpool}.
 * @throws An {@link Error} if {@link Whirlpool} creation fails to complete.
 */
export async function createWhirlpool(whirlpoolArgs: WhirlpoolCreateArgs): Promise<Whirlpool> {
  const initialTick = PriceMath.priceToTickIndex(
    whirlpoolArgs.initialPrice,
    whirlpoolArgs.tokenAMeta.decimals,
    whirlpoolArgs.tokenBMeta.decimals
  );

  const { poolKey, tx } = await whirlpoolClient().createPool(
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    whirlpoolArgs.tokenAMeta.address,
    whirlpoolArgs.tokenBMeta.address,
    whirlpoolArgs.tickSpacing,
    initialTick,
    whirlpoolClient().getContext().wallet.publicKey
  );

  debug('Creating whirlpool...');
  await sendTx(tx);
  debug('Whirlpool created with address:', poolKey);

  return whirlpoolClient().getPool(poolKey);
}
