import type { CliArgs } from '@/interfaces/cli';
import { error, info } from '@/util/log';
import { toSol } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import yargs from 'yargs';

const cli = {
  description: 'Calculate the rent exemption amount for an account based off of a specified byte size.',
  options: {
    size: {
      alias: 's',
      describe: 'The byte size of the account to calculate rent exemption for',
      demandOption: true,
      type: 'number' as const,
    }
  },
  builder: () =>
    yargs(process.argv.slice(2))
      .usage('Usage: $0 --size [number]')
      .options(cli.options),
  handler
};

/**
 * Gets the rent exemption amount for an account with a specified byte size.
 *
 * @param argv The CLI arguments passed to the command.
 */
async function handler(argv?: CliArgs<typeof cli.options>) {
  const lamports = await rpc().getMinimumBalanceForRentExemption(argv!.size!);

  info(`Rent exemption amount for Account ( size: ${argv!.size} ): ${toSol(lamports)} SOL`);
}

if (process.env.NO_EXEC_CLI !== 'true') {
  handler()
    .then(() => process.exit(0))
    .catch((err) => {
      error(err);
      process.exit(1);
    });
}

export default cli;
