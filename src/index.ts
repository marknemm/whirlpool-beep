import { env } from '@/util/env'; // Load and validate env variables ASAP

import { getTokenMetaPair } from '@/services/token/query';
import { getBalance } from '@/services/wallet/get-balance';
import { getPrice } from '@/services/whirlpool/get-price';
import { getValidateKeypair, writeWalletJson } from '@/util/wallet-keypair';
import { error } from './util/log';

/**
 * Main entry point.
 */
async function main() {
  try {
    // Initialization using wallet private key
    const keypair = getValidateKeypair();
    await writeWalletJson(keypair);

    // Fetch token metadata (will throw error if tokens are not found)
    const [tokenAMeta, tokenBMeta] = await getTokenMetaPair();

    // Check wallet account balance
    await getBalance();

    // Check price of whirlpool
    await getPrice({
      tickSpacing: env.TICK_SPACING,
      tokenAMeta,
      tokenBMeta,
    });

    // Open a position in whirlpool
    // openPosition({
    //   tickSpacing: env.TICK_SPACING,
    //   tokenAMeta,
    //   tokenBMeta,
    // }, Percentage.fromFraction(5, 100), new Decimal(3));
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

main();
