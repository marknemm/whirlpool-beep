import type { WhirlpoolPriceData } from '@/interfaces/whirlpool';
import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * Log the price of a token, {@link tokenA}, in terms of another token, {@link tokenB}.
 * If input is missing, this function does nothing.
 *
 * @param tokenPrice The {@link WhirlpoolPriceData} to log.
 */
export function logPrice(tokenPrice: WhirlpoolPriceData) {
  if (!tokenPrice) return;
  const { price, tokenA, tokenB } = tokenPrice;

  const fixedPrice = parseFloat(price.toFixed(tokenB.decimals));
  console.log(`Price of ${tokenA.symbol} in terms of ${tokenB.symbol}:`, fixedPrice);
}

/**
 * Log the price range data for a {@link Whirlpool} position.
 *
 * @param lowerTickIdx The lower tick index of the position.
 * @param upperTickIdx The upper tick index of the position.
 * @param whirlpool The {@link Whirlpool} to log the position range for.
 */
export function logPositionRange(lowerTickIdx: number, upperTickIdx: number, whirlpool: Whirlpool) {
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  console.log('Lower & upper tick index:', lowerTickIdx, upperTickIdx);
  console.log('Lower & upper price:',
    PriceMath.tickIndexToPrice(lowerTickIdx, tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
    PriceMath.tickIndexToPrice(upperTickIdx, tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals)
  );
}
