import type { CliArgs } from '@npc/core';
import { error, info } from '@npc/core';
import rpc from '@npc/solana/util/rpc/rpc.js';
import { toSol } from '@npc/solana/util/unit-conversion/unit-conversion.js';
import { type Argv } from 'yargs';

const cli = {
  command: 'rent-cost',
  description: 'Calculate the rent exemption amount for an account based off of a specified byte size.',
  options: {
    size: {
      alias: 's',
      describe: 'The byte size of the account to calculate rent exemption for',
      demandOption: true,
      type: 'number' as const,
    }
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler
};

/**
 * Gets the rent exemption amount for an account with a specified byte size.
 *
 * @param argv The CLI arguments passed to the command.
 */
async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const lamports = await rpc().getMinimumBalanceForRentExemption(argv!.size!);

    info(`Rent exemption amount for Account ( size: ${argv!.size} ): ${toSol(lamports)} SOL`);
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
