import type { TokenPriceData } from '@/interfaces/token';

/**
 * Log the price of a token, {@link tokenA}, in terms of another token, {@link tokenB}.
 * If input is missing, this function does nothing.
 *
 * @param tokenA The token to log the price of.
 * @param tokenB The token to log the price in terms of.
 * @param price The price of {@link tokenA} in terms of {@link tokenB}.
 */
export function logPrice(tokenPrice: TokenPriceData) {
  if (!tokenPrice) return;
  const { price, tokenA, tokenB } = tokenPrice;

  const fixedPrice = parseFloat(price.toFixed(tokenB.decimals));
  console.log(`Price of ${tokenA.symbol} in terms of ${tokenB.symbol}:`, fixedPrice);
}
