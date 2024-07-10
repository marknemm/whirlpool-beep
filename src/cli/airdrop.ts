import { toLamports } from '@/util/number-conversion';
import env from '@/util/env';
import { error, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import wallet from '@/util/wallet';
import yargs from 'yargs';

const argv = yargs(process.argv.slice(2))
  .usage('Usage: $0 <amount>')
  .options({
    amount: {
      alias: 'a',
      default: 1,
      describe: 'The amount of SOL to airdrop',
      type: 'number',
    }
  }).parseSync();

async function main() {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Airdrop is only available in development environment');
  }

  info(`Airdropping ${argv.amount} SOL to wallet:`, wallet().publicKey.toBase58());

  // Send the transaction
  const signature = await rpc().requestAirdrop(wallet().publicKey, toLamports(argv.amount));
  verifyTransaction(signature);

  info('Airdrop complete - wallet balance:', await wallet().getBalance());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
