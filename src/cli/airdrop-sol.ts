import { getBalance } from '@/services/wallet/get-balance';
import anchor from '@/util/anchor';
import { toLamports } from '@/util/currency';
import { debug } from '@/util/log';
import rpc from '@/util/rpc';

async function main() {
  const { wallet } = anchor();

  debug('RPC endpoint:', rpc().rpcEndpoint);
  debug('wallet address:', wallet.publicKey.toBase58());

  // Send the transaction
  const signature = await rpc().requestAirdrop(wallet.publicKey, toLamports(1));
  debug('signature:', signature);

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  await rpc().confirmTransaction({ signature, ...latestBlockhash });
  await getBalance(); // Implicitly does debug log
}

main().then(() => process.exit(0));
