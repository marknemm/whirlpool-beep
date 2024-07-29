import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@/cli/common/whirlpool-opts';
import type { CliArgs } from '@/util/cli/cli.interfaces';
import { getPositions } from '@/services/position/query/query-position';
import { error, info } from '@/util/log/log';
import { type Argv } from 'yargs';

const cli = {
  command: 'list',
  description: 'List all position addresses.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be listed.\n'
    + 'Otherwise, all owned positions will be listed.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to list all positions under',
      },
    }),
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
    const bundledPositions = await getPositions({ whirlpoolAddress });

    info('Positions:', bundledPositions.map((pos) => pos.position.getAddress().toBase58()));

    whirlpoolAddress
      ? info(`Retrieved ${bundledPositions.length} owned positions under whirlpool:`, whirlpoolAddress.toBase58())
      : info(`Retrieved ${bundledPositions.length} owned positions`);
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
