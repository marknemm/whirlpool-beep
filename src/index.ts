import { env } from '@/util/env'; // Load and validate env variables ASAP

import { getTokenMetaPair } from '@/services/token/query';
import { getBalance } from '@/services/wallet/get-balance';
import { getPrice } from '@/services/whirlpool/get-price';
import { logPrice } from '@/util/log';
import { getValidateKeypair, writeWalletJson } from '@/util/wallet-keypair';

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
    const balance = await getBalance();
    console.log('Wallet balance:', balance, 'SOL');

    // Check price of whirlpool
    const price = await getPrice({
      tickSpacing: env.TICK_SPACING,
      tokenAMeta,
      tokenBMeta,
    });
    logPrice(price);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
