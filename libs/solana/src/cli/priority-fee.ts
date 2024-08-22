import type { CliArgs } from '@npc/core';
import { error, warn } from '@npc/core';
import { getFallbackPriorityFeeEstimate, getHeliusPriorityFeeEstimate } from '@npc/solana/util/transaction-budget/transaction-budget';
import { getTxInstructions } from '@npc/solana/util/transaction/transaction';
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
    const ixs = getTxInstructions(argv.transaction);

    if (['all', 'helius'].find((s) => s === argv.estimator)) {
      try {
        await getHeliusPriorityFeeEstimate(ixs); // Will log the priority fee estimate via debug log.
      } catch (err) {
        const log = argv.estimator === 'helius'
          ? error
          : warn;
        log('Could not get helius priority fee estimate:', err);
      }
    }

    if (['all', 'fallback'].find((s) => s === argv.estimator)) {
      try {
        await getFallbackPriorityFeeEstimate(ixs); // Will log the priority fee estimate via debug log.
      } catch (err) {
        error('Could not get fallback priority fee estimate:', err);
      }
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
