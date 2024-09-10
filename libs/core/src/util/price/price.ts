import type { Null } from '@npc/core/interfaces/nullable.interfaces';
import { toDecimal } from '@npc/core/util/numeric/numeric';
import BN from 'bn.js';
import Decimal from 'decimal.js';

/**
 * Computes a price range based off of a given price and price margin.
 *
 * @param price The price to compute the price range for.
 * @param priceMargin The price margin to use.
 * @returns A 2-index array containing the lower and upper price range bounds.
 */
export function genPriceMarginRange(
  price: BN | Decimal.Value | Null,
  priceMargin: Decimal.Value | Null
): [Decimal, Decimal] {
  if (!price || !priceMargin) return [new Decimal(0), new Decimal(0)];
  price = toDecimal(price);

  const priceMarginValue = price.mul(priceMargin);
  const lowerPrice = price.minus(priceMarginValue);
  const upperPrice = price.plus(priceMarginValue);

  return [lowerPrice, upperPrice];
}

/**
 * Inverts a given price.
 *
 * @param price The price to invert.
 * @returns The inverted price.
 */
export function invertPrice(price: BN | Decimal.Value | Null): Decimal {
  return price
    ? new Decimal(1).div(toDecimal(price))
    : new Decimal(0);
}

/**
 * Converts a given {@link usd} amount to a token amount based off of a given {@link tokenPrice}.
 *
 * @param usd The amount of `USD` to convert.
 * @param tokenPrice The price of the token in `USD`.
 * @returns The converted token amount.
 */
export function usdToTokenAmount(
  usd: BN | Decimal.Value | Null,
  tokenPrice: Decimal.Value | Null
): Decimal {
  return (usd && tokenPrice)
    ? toDecimal(usd).div(tokenPrice)
    : new Decimal(0);
}

/**
 * Converts a given token amount to `USD` based off of a given {@link tokenPrice}.
 *
 * @param tokenAmount The amount of the token to convert.
 * @param tokenPrice The price of the token in `USD`.
 * @param shift The number of decimal places to `left shift` the decimal point by. Defaults to `0`.
 * For example, if {@link shift} is `2`, the {@link value} `100` would be converted to `1.00`.
 * Will only shift the decimal point if the value is not a {@link Decimal.Value}.
 * @returns The converted `USD` amount.
 */
export function tokenAmountToUSD(
  tokenAmount: BN | Decimal | number | Null,
  tokenPrice: Decimal.Value | Null,
  shift = 0
): Decimal {
  return (tokenAmount && tokenPrice)
    ? toDecimal(tokenAmount, shift).mul(tokenPrice)
    : new Decimal(0);
}
