import type { RebalanceAllPositionsOptions } from '@/interfaces/position';
import { info } from '@/util/log';

/**
 * Entrypoint for the `serverless` rebalance cloud function.
 */
export async function rebalance() {
  info('-- Rebalance Fn --');

  // const rebalanceOptions: RebalanceAllPositionsOptions = {
  //   whirlpoolAddress,
  //   liquidity: argv.liquidity,
  //   liquidityUnit: argv.liquidityUnit,
  //   filter: genPriceRangeRebalanceFilter(
  //     Percentage.fromFraction(argv.priceRangeMargin, 100)
  //   )
  // };
}
