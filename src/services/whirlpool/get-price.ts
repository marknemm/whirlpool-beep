import type { TokenPriceData } from '@/interfaces/token';
import type { WhirlpoolArgs } from '@/interfaces/whirlpool';
import { whirlpoolClient } from '@/util/whirlpool-client';
import type { Whirlpool } from '@orca-so/whirlpools-sdk';
import { PriceMath } from '@orca-so/whirlpools-sdk';

/**
 * Get the price of a {@link Whirlpool} defined by {@link whirlpoolArgs}.
 *
 * The price is the price of {@link tokenA} in terms of {@link tokenB}.
 *
 * @param whirlpoolArgs The {@link WhirlpoolArgs arguments} to derive the {@link Whirlpool} and calculate the price.
 * @returns A {@link Promise} that resolves to the {@link TokenPriceData} of the {@link Whirlpool}.
 */
export async function getPrice(whirlpoolArgs: WhirlpoolArgs): Promise<TokenPriceData> {
  const client = whirlpoolClient();

  const whirlpool = await client.getPoolViaPDA(whirlpoolArgs);
  const tokenA = { ...whirlpoolArgs.tokenAMeta, ...whirlpool.getTokenAInfo() };
  const tokenB = { ...whirlpoolArgs.tokenBMeta, ...whirlpool.getTokenBInfo() };

  // Get the current price of the pool
  const sqrtPrice = whirlpool.getData().sqrtPrice;
  const price = PriceMath.sqrtPriceX64ToPrice(sqrtPrice, tokenA.decimals, tokenB.decimals);

  return { price, sqrtPrice, tokenA, tokenB, whirlpool };
}
