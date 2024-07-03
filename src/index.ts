import env from '@/util/env'; // Load and validate env variables ASAP

import { getTickArray } from '@/services/tick-array/get-tick-array';
import { getTokenPair } from '@/services/token/get-token';
import { getWalletBalance } from '@/services/wallet/get-balance';
import { getWhirlpool } from '@/services/whirlpool/get-whirlpool';
import { toPrice } from '@/util/currency';
import { debug, error } from '@/util/log';

/**
 * Main entry point.
 */
async function main() {
  try {
    debug('Environment variables loaded and validated:', { ...env });

    // Fetch token metadata (will throw error if tokens are not found)
    const [tokenA, tokenB] = await getTokenPair(env.TOKEN_A, env.TOKEN_B);

    // Check wallet account balance
    await getWalletBalance(tokenA.mint.publicKey);
    await getWalletBalance(tokenB.mint.publicKey);

    // Get whirlpool
    const whirlpool = await getWhirlpool(tokenA.mint.publicKey, tokenB.mint.publicKey, env.TICK_SPACING);

    // Check price of whirlpool
    const price = toPrice(whirlpool);
    debug(`Price of ${tokenA.metadata.symbol} in terms of ${tokenB.metadata.symbol}:`,
          price.toFixed(tokenB.mint.decimals));

    const tickArray = await getTickArray(whirlpool);
    debug('Tick array data:', tickArray.data?.ticks[0], tickArray.data?.ticks[tickArray.data.ticks.length - 1]);

    // Open a position in whirlpool
    // openPosition(whirlpool, Percentage.fromFraction(5, 100), new Decimal(3));
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
