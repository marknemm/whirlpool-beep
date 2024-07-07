import env from '@/util/env'; // Load and validate env variables ASAP

import { getBundledPositions, getPositions } from '@/services/position/get-position';
import { increaseLiquidity } from '@/services/position/increase-liquidity';
import { getTickArray } from '@/services/tick-array/get-tick-array';
import { getTokenPair } from '@/services/token/get-token';
import { getWalletBalance } from '@/services/wallet/get-balance';
import { getWhirlpool } from '@/services/whirlpool/get-whirlpool';
import { toPrice } from '@/util/currency';
import { debug, error } from '@/util/log';
import Decimal from 'decimal.js';
import { collectAllFeesRewards } from './services/position/collect-fees-rewards';
import { closePosition } from './services/position/close-position';

/**
 * Main entry point.
 */
async function main() {
  debug('Environment variables loaded and validated:', { ...env });

  const [tokenA, tokenB] = await getTokenPair(env.TOKEN_A, env.TOKEN_B); // throws error if not found

  await getWalletBalance(tokenA.mint.publicKey);
  await getWalletBalance(tokenB.mint.publicKey);

  const whirlpool = await getWhirlpool(tokenA.mint.publicKey, tokenB.mint.publicKey, env.TICK_SPACING);

  const price = toPrice(whirlpool);
  debug(`Price of ${tokenA.metadata.symbol} in terms of ${tokenB.metadata.symbol}:`,
        price.toFixed(tokenB.mint.decimals));

  const tickArray = await getTickArray(whirlpool);
  debug('Tick array data:', tickArray.data?.ticks[0], tickArray.data?.ticks[tickArray.data.ticks.length - 1]);

  // Open a position in whirlpool
  // const position = await openPosition(whirlpool, Percentage.fromFraction(3, 100));
  // debug('Opened position:', position.getAddress().toBase58());

  // const positions = await getPositions();
  // debug('Positions:', positions.map((position) => position.getAddress().toBase58()));
  // await increaseLiquidity(positions[0], new Decimal(1));

  const bundledPositions = await getBundledPositions();
  await closePosition(bundledPositions[0]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
