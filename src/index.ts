import rpc from '@/util/rpc';
import { getValidateKeypair } from '@/util/wallet-keypair';

/**
 * Main entry point.
 */
async function main() {
  try {
    const keypair = getValidateKeypair();

    await rpc.getBalance(keypair.publicKey);

    console.log('Wallet balance:', (await rpc.getBalance(keypair.publicKey)) / 1e9, 'SOL');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
