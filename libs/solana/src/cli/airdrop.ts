import type { CliArgs } from '@npc/core';
import { env, error, info } from '@npc/core';
import rpc from '@npc/solana/util/rpc/rpc';
import { confirmTx } from '@npc/solana/util/transaction-exec/transaction-exec';
import { toLamports } from '@npc/solana/util/unit-conversion/unit-conversion';
import wallet from '@npc/solana/util/wallet/wallet';
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
    await confirmTx(signature);

    info('Airdrop complete - wallet balance:', await wallet().getBalance());
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
