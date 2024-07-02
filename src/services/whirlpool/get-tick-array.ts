import { debug, info } from '@/util/log';
import whirlpoolClient, { getTokenInfoPair } from '@/util/whirlpool';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath, type TickArray, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Get a tick array using the PDA derived from the given {@link price} and {@link whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} that the {@link TickArray} is associated with.
 * @param price The price that is contained within the {@link TickArray} that is to be retrieved.
 * @returns A {@link Promise} that resolves to the {@link TickArray}.
 * The {@link TickArray.data} field will be `null` if the tick array does not exist.
 * @throws An {@link Error} if the {@link TickArrayArgs} are invalid.
 */
export async function getTickArrayViaPrice(whirlpool: Whirlpool, price: Decimal): Promise<TickArray> {
  const [tokenA, tokenB] = getTokenInfoPair(whirlpool);

  const tickIdx = PriceMath.priceToTickIndex(price, tokenA.decimals, tokenB.decimals);

  return getTickArray(whirlpool, tickIdx);
}

/**
 * Get a tick array using the PDA derived from the given {@link tickIdx} and {@link whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} that the {@link TickArray} is associated with.
 * @param tickIdx The tick index that is contained within the {@link TickArray} that is to be retrieved.
 * Defaults to the current tick index of the {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the {@link TickArray}.
 * The {@link TickArray.data} field will be `null` if the tick array does not exist.
 * @throws An {@link Error} if the {@link TickArrayArgs} are invalid.
 */
export async function getTickArray(
  whirlpool: Whirlpool,
  tickIdx: number = whirlpool.getData().tickCurrentIndex
): Promise<TickArray> {
  debug('Deriving PDA of tick array via tick index:', tickIdx);

  const tickArrayPublicKey = PDAUtil.getTickArrayFromTickIndex(
    tickIdx,
    whirlpool.getData().tickSpacing,
    whirlpool.getAddress(),
    ORCA_WHIRLPOOL_PROGRAM_ID
  ).publicKey;

  const tickArrayData = await whirlpoolClient().getFetcher().getTickArray(tickArrayPublicKey);
  tickArrayData
    ? info('Retrieved tick array starting at tick index:', tickArrayData?.startTickIndex)
    : info('Tick array does not exist');

  return { data: tickArrayData, address: tickArrayPublicKey };
}
