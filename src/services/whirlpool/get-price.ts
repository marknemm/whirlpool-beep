import type { WhirlpoolArgs, WhirlpoolPriceData } from '@/interfaces/whirlpool';
import { logPrice } from '@/util/log';
import { whirlpoolClient } from '@/util/whirlpool-client';
import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * Get the price of a {@link Whirlpool} defined by {@link whirlpoolArgs}.
 *
 * The price is the price of {@link tokenA} in terms of {@link tokenB}.
 *
 * @param whirlpoolArgs The {@link WhirlpoolArgs arguments} to derive the {@link Whirlpool} and calculate the price.
 * @returns A {@link Promise} that resolves to the {@link WhirlpoolPriceData} of the {@link Whirlpool}.
 */
export async function getPrice(whirlpoolArgs: WhirlpoolArgs): Promise<WhirlpoolPriceData> {
  const client = whirlpoolClient();

  const whirlpool = await client.getPoolViaPDA(whirlpoolArgs);
  const tokenA = { ...whirlpoolArgs.tokenAMeta, ...whirlpool.getTokenAInfo() };
  const tokenB = { ...whirlpoolArgs.tokenBMeta, ...whirlpool.getTokenBInfo() };

  // Get the current price of the pool
  const sqrtPrice = whirlpool.getData().sqrtPrice;
  const price = PriceMath.sqrtPriceX64ToPrice(sqrtPrice, tokenA.decimals, tokenB.decimals);

  const priceData: WhirlpoolPriceData = { price, sqrtPrice, tokenA, tokenB, whirlpool };
  logPrice(priceData);
  return priceData;
}
