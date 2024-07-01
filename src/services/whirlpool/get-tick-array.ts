import { debug, info } from '@/util/log';
import whirlpoolClient, { type TickArrayArgs } from '@/util/whirlpool';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type TickArrayData } from '@orca-so/whirlpools-sdk';

/**
 * Get a tick array using the PDA derived from the given {@link TickArrayArgs}.
 *
 * @param tickArrayArgs The {@link TickArrayArgs} to derive the {@link TickArray} PDA.
 * @returns A {@link Promise} that resolves to the {@link TickArrayData} or `null` if the tick array does not exist.
 * @throws An {@link Error} if the {@link TickArrayArgs} are invalid.
 */
export async function getTickArray(tickArrayArgs: TickArrayArgs): Promise<TickArrayData | null> {
  const tickIdx = (typeof tickArrayArgs.priceOrTickIdx === 'number')
    ? tickArrayArgs.priceOrTickIdx
    : null;

  const priceData = (typeof tickArrayArgs.priceOrTickIdx === 'object')
    ? tickArrayArgs.priceOrTickIdx
    : null;

  debug(`Deriving PDA of tick array via ${priceData ? 'price data' : 'tick index'}:`, tickArrayArgs.priceOrTickIdx);

  const tickArrayPublicKey = priceData
    ? PDAUtil.getTickArrayFromSqrtPrice(
      priceData.sqrtPrice,
      tickArrayArgs.whirlpool.getData().tickSpacing,
      tickArrayArgs.whirlpool.getAddress(),
      ORCA_WHIRLPOOL_PROGRAM_ID
    ).publicKey
    : PDAUtil.getTickArrayFromTickIndex(
      tickIdx!,
      tickArrayArgs.whirlpool.getData().tickSpacing,
      tickArrayArgs.whirlpool.getAddress(),
      ORCA_WHIRLPOOL_PROGRAM_ID
    ).publicKey;

  const tickArrayData = await whirlpoolClient().getFetcher().getTickArray(tickArrayPublicKey);
  tickArrayData
    ? info('Retrieved tick array starting at tick index:', tickArrayData?.startTickIndex)
    : info('Tick array does not exist');

  return tickArrayData;
}
