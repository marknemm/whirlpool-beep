import env from '@/util/env'; // Load and validate env variables ASAP

import { increaseAllLiquidity } from '@/services/position/increase-liquidity';
import { genPriceRangeRebalanceFilter, rebalanceAllPositions } from '@/services/position/rebalance-position';
import { debug, error } from '@/util/log';
import { getWhirlpoolKey } from './util/whirlpool';

/**
 * Main entry point.
 */
async function main() {
  debug('Environment variables loaded and validated:', { ...env });

  const whirlpoolAddress = await getWhirlpoolKey('SOL', 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k', 64);
  await increaseAllLiquidity(whirlpoolAddress, 3);

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
