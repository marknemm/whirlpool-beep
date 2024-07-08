import env from '@/util/env'; // Load and validate env variables ASAP

import { closePosition } from '@/services/position/close-position';
import { getBundledPositions } from '@/services/position/get-position';
import { getTickArray } from '@/services/tick-array/get-tick-array';
import { getWhirlpool } from '@/services/whirlpool/get-whirlpool';
import { toPrice } from '@/util/currency';
import { debug, error } from '@/util/log';
import { getTokenPair } from '@/util/token';
import wallet from '@/util/wallet';

/**
 * Main entry point.
 */
async function main() {
  debug('Environment variables loaded and validated:', { ...env });

  const [tokenA, tokenB] = await getTokenPair(env.TOKEN_A, env.TOKEN_B); // throws error if not found

  await wallet().getBalance(tokenA.mint.publicKey);
  await wallet().getBalance(tokenB.mint.publicKey);

  const whirlpool = await getWhirlpool(tokenA.mint.publicKey, tokenB.mint.publicKey, env.TICK_SPACING);

  const price = toPrice(whirlpool);
  debug(`Price of ${tokenA.metadata.symbol} in terms of ${tokenB.metadata.symbol}:`,
        price.toFixed(tokenB.mint.decimals));

  const tickArray = await getTickArray(whirlpool);
  debug('Tick array data:', tickArray.data?.ticks[0], tickArray.data?.ticks[tickArray.data.ticks.length - 1]);

  // Open a position in whirlpool and increase liquidity
  // const bundledPosition = await openPosition(whirlpool, Percentage.fromFraction(3, 100));
  // await increaseLiquidity(bundledPosition.position, new Decimal(1));

  const bundledPositions = await getBundledPositions();
  const [bundledPosition] = bundledPositions;
  // await decreaseLiquidity(position, position.getData().liquidity);
  await closePosition(bundledPosition);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
