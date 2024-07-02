import env from '@/util/env'; // Load and validate env variables ASAP

import { getTokenMetaPair } from '@/services/token/get-token';
import { getWalletBalance } from '@/services/wallet/get-balance';
import { getTickArray } from '@/services/whirlpool/get-tick-array';
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
    const [tokenAMeta, tokenBMeta] = await getTokenMetaPair(env.TOKEN_A, env.TOKEN_B);

    // Check wallet account balance
    await getWalletBalance(tokenAMeta.address);
    await getWalletBalance(tokenBMeta.address);

    // Get whirlpool
    const whirlpool = await getWhirlpool(tokenAMeta.address, tokenBMeta.address, env.TICK_SPACING);

    // Check price of whirlpool
    const price = toPrice(whirlpool);
    debug(`Price of ${tokenAMeta.symbol} in terms of ${tokenBMeta.symbol}:`, price.toFixed(tokenBMeta.decimals));

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
