import { getPrice } from '@/services/get-price';
import { getValidateKeypair, writeWalletJson } from '@/util/wallet-keypair';
import { whirlpoolClient } from '@/util/whirlpool-client';
import { SAMO_TOKEN_META, USDC_TOKEN_META } from './constants/token';
import { logPrice } from './util/log';

/**
 * Main entry point.
 */
async function main() {
  try {
    if (!process.env.NODE_ENV) {
      throw new Error('NODE_ENV is not set.');
    }

    // Initialization
    const keypair = getValidateKeypair();
    await writeWalletJson(keypair);

    const ctx = whirlpoolClient().getContext();
    const rpc = ctx.connection;
    const publicKey = ctx.wallet.publicKey;

    const balance = (await rpc.getBalance(publicKey)) / 1e9;
    console.log('Wallet balance:', balance, 'SOL');

    const price = await getPrice({
      tickSpacing: 64,
      tokenAMeta: SAMO_TOKEN_META,
      tokenBMeta: USDC_TOKEN_META,
    });
    logPrice(price);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
