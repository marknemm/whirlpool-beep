import type { CliArgs } from '@/interfaces/cli';
import { error } from '@/util/log';
import { getFallbackPriorityFeeEstimate, getHeliusPriorityFeeEstimate } from '@/util/transaction-budget';
import { VersionedTransaction } from '@solana/web3.js';
import { type Argv } from 'yargs';

const cli = {
  command: 'priority-fee',
  description: 'Get the recommended priority fee based off of the current network state.',
  options: {
    estimator: {
      alias: 'e',
      description: 'The estimator from which to get the priority fee estimate.',
      group: 'Estimate',
      choices: ['all', 'helius', 'fallback'] as const,
      default: 'all',
      type: 'number' as const,
    },
    transaction: {
      alias: 't',
      description: 'The base64 serialized transaction to get the priority fee estimate for.',
      group: 'Estimate',
      type: 'string' as const,
    }
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler
};

/**
 * Gets the recommended priority fee based off of the current network state.
 *
 * @param argv The CLI arguments passed to the command.
 */
async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const tx = argv.transaction
      ? VersionedTransaction.deserialize(Buffer.from(argv.transaction, 'base64'))
      : undefined;

    if (['all', 'helius'].find((s) => s === argv.estimator)) {
      await getHeliusPriorityFeeEstimate(tx); // Will log the priority fee estimate via debug log.
    }

    if (['all', 'fallback'].find((s) => s === argv.estimator)) {
      await getFallbackPriorityFeeEstimate(tx); // Will log the priority fee estimate via debug log.
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
