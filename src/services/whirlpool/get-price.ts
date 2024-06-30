import type { WhirlpoolPriceData } from '@/interfaces/whirlpool';
import { toNum } from '@/util/currency';
import env from '@/util/env';
import { debug } from '@/util/log';
import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * Get the price of a {@link Whirlpool} defined by {@link whirlpoolArgs}.
 *
 * The price is the price of {@link tokenA} in terms of {@link tokenB}.
 *
 * @param whirlpool The {@link Whirlpool} to get the price of.
 * @returns A {@link Promise} that resolves to the {@link WhirlpoolPriceData} of the {@link Whirlpool}.
 */
export async function getPrice(whirlpool: Whirlpool): Promise<WhirlpoolPriceData> {
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  // Get the current price of the pool
  const { sqrtPrice } = whirlpool.getData();
  const price = PriceMath.sqrtPriceX64ToPrice(sqrtPrice, tokenA.decimals, tokenB.decimals);

  const priceData: WhirlpoolPriceData = { price, sqrtPrice, whirlpool };
  debug(`Price of ${env.TOKEN_A} in terms of ${env.TOKEN_B}:`, toNum(price, tokenB.decimals));

  return priceData;
}
