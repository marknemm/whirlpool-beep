import { genPriceRangeRebalanceFilter, rebalanceAllPositions } from '@/services/position/rebalance-position';
import env from '@/util/env';
import { info } from '@/util/log';

/**
 * Entrypoint for the `serverless` rebalance cloud function.
 */
export async function rebalance() {
  info('Environment variables loaded and validated:', { ...env });

  await rebalanceAllPositions({
    filter: genPriceRangeRebalanceFilter(),
    liquidity: 100,
  });
}
