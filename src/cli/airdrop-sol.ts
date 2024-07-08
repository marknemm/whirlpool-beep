import { toLamports } from '@/util/currency';
import { debug, info } from '@/util/log';
import rpc from '@/util/rpc';
import wallet from '@/util/wallet';

async function main() {
  info('RPC endpoint:', rpc().rpcEndpoint);
  info('wallet address:', wallet().publicKey.toBase58());

  // Send the transaction
  const signature = await rpc().requestAirdrop(wallet().publicKey, toLamports(1));
  debug('signature:', signature);

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  await rpc().confirmTransaction({ signature, ...latestBlockhash });
  info('Airdrop complete - wallet balance:', await wallet().getBalance());
}

main().then(() => process.exit(0));
