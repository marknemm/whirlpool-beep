import env from '@/util/env'; // Load and validate env variables ASAP

import { genPriceRangeRebalanceFilter, rebalanceAllPositions } from '@/services/position/rebalance-position';
import { debug, error } from '@/util/log';

/**
 * Main entry point.
 */
async function main() {
  debug('Environment variables loaded and validated:', { ...env });

  await rebalanceAllPositions({
    filter: genPriceRangeRebalanceFilter(),
    liquidity: 10,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
