import type { CliArgs } from '@/interfaces/cli';
import env from '@/util/env';
import { error, info } from '@/util/log';
import { toLamports } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { verifyTransaction } from '@/util/transaction';
import wallet from '@/util/wallet';
import { type Argv } from 'yargs';

const cli = {
  command: 'airdrop',
  description: 'Airdrops SOL to the wallet configured via ENV vars.',
  options: {
    amount: {
      alias: 'a',
      default: 1,
      describe: 'The amount of SOL to airdrop',
      type: 'number' as const,
    }
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler
};

/**
 * Airdrops SOL to the wallet configured via ENV vars.
 *
 * @param argv The CLI arguments passed to the command.
 */
async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    if (env.NODE_ENV !== 'development') {
      throw new Error('Airdrop is only available in development environment');
    }

    info(`Airdropping ${argv.amount} SOL to wallet:`, wallet().publicKey.toBase58());

    // Send the transaction
    const signature = await rpc().requestAirdrop(wallet().publicKey, toLamports(argv.amount));
    verifyTransaction(signature);

    info('Airdrop complete - wallet balance:', await wallet().getBalance());
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
