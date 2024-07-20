import { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { Percentage } from '@orca-so/common-sdk';
import { type Position, PriceMath } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Calculates the price margin for a given {@link Position}.
 * The price margin is the percentage of the position mid price that the upper and lower prices are away from the mid price.
 *
 * @param position The {@link Position} to calculate the price margin for.
 * @returns A {@link Promise} that resolves to the price margin as a {@link Percentage}.
 */
export async function calcPriceMargin(position: Position): Promise<Percentage> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

  const [oldPriceLower, oldPriceUpper] = toPriceRange(
    [position.getData().tickLowerIndex, position.getData().tickUpperIndex],
    [tokenA.mint.decimals, tokenB.mint.decimals]
  );

  const oldPriceMid = oldPriceLower.add(oldPriceUpper).div(2);
  const calcPriceMargin = oldPriceMid.div(oldPriceLower).minus(1);

  return Percentage.fromFraction(calcPriceMargin.mul(100).round().toNumber(), 100);
}

/**
 * Converts a given tick range to a price range.
 *
 * @param tickRange The tick range to convert.
 * @param decimalPair The decimal pair to use for the conversion.
 * The first element is the decimal for `token A`, and the second element is the decimal for `token B`.
 * @returns The converted price range.
 */
export function toPriceRange(
  tickRange: [number, number],
  decimalPair: [number, number]
): [Decimal, Decimal] {
  const [decimalsA, decimalsB] = decimalPair;

  return [
    PriceMath.tickIndexToPrice(tickRange[0], decimalsA, decimalsB),
    PriceMath.tickIndexToPrice(tickRange[1], decimalsA, decimalsB),
  ];
}

/**
 * Converts a given price range to a tick range.
 *
 * If {@link tickSpacing} is provided, the conversion will account for spacing and may not be an exact mapping.
 *
 * @param priceRange The price range to convert.
 * @param decimalPair The decimal pair to use for the conversion.
 * The first element is the decimal for `token A`, and the second element is the decimal for `token B`.
 * @param tickSpacing The tick spacing to use for the conversion. Defaults to `1`.
 * @returns The converted tick range.
 */
export function toTickRange(
  priceRange: [Decimal, Decimal],
  decimalPair: [number, number],
  tickSpacing?: number
): [number, number] {
  const [decimalsA, decimalsB] = decimalPair;

  return tickSpacing
    ? [
      PriceMath.priceToInitializableTickIndex(priceRange[0], decimalsA, decimalsB, tickSpacing),
      PriceMath.priceToInitializableTickIndex(priceRange[1], decimalsA, decimalsB, tickSpacing),
    ]
    : [
      PriceMath.priceToTickIndex(priceRange[0], decimalsA, decimalsB),
      PriceMath.priceToTickIndex(priceRange[1], decimalsA, decimalsB),
    ];
}
