import { getPrice } from '@/services/get-price';
import { getValidateKeypair, writeWalletJson } from '@/util/wallet-keypair';
import { whirlpoolClient } from '@/util/whirlpool-client';

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

    await getPrice();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
