import type { TokenPriceData } from '@/interfaces/token';
import { PriceMath, type TokenInfo } from '@orca-so/whirlpools-sdk';

/**
 * Log the price of a token, {@link tokenA}, in terms of another token, {@link tokenB}.
 * If input is missing, this function does nothing.
 *
 * @param tokenPrice The {@link TokenPriceData} to log.
 */
export function logPrice(tokenPrice: TokenPriceData) {
  if (!tokenPrice) return;
  const { price, tokenA, tokenB } = tokenPrice;

  const fixedPrice = parseFloat(price.toFixed(tokenB.decimals));
  console.log(`Price of ${tokenA.symbol} in terms of ${tokenB.symbol}:`, fixedPrice);
}

export function logPositionRange(lowerTickIdx: number, upperTickIdx: number, tokenA: TokenInfo, tokenB: TokenInfo) {
  console.log('lower & upper tick index:', lowerTickIdx, upperTickIdx);
  console.log('lower & upper price:',
    PriceMath.tickIndexToPrice(lowerTickIdx, tokenA.decimals, tokenB.decimals).toFixed(Math.min(tokenA.decimals, tokenB.decimals)),
    PriceMath.tickIndexToPrice(upperTickIdx, tokenA.decimals, tokenB.decimals).toFixed(Math.min(tokenA.decimals, tokenB.decimals))
  );
}
