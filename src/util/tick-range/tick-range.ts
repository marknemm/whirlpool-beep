import { getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { Address, AddressUtil, Percentage } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath, TickUtil, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { type PublicKey } from '@solana/web3.js';
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

/**
 * Converts a given tick range to a pair of tick array {@link PublicKey}s.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to get the tick array keys for.
 * @param tickRange The tick index range to get the tick array keys for.
 * @param tickSpacing The tick spacing of the {@link Whirlpool}.
 * @returns The pair of tick array {@link PublicKey}s.
 */
export function toTickRangeKeys(
  whirlpoolAddress: Address,
  tickRange: [number, number],
  tickSpacing: number
): [PublicKey, PublicKey] {
  return tickRange.map((tickIdx) =>
    PDAUtil.getTickArrayFromTickIndex(
      tickIdx,
      tickSpacing,
      AddressUtil.toPubKey(whirlpoolAddress),
      ORCA_WHIRLPOOL_PROGRAM_ID
    ).publicKey
  ) as [PublicKey, PublicKey];
}
