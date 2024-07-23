import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@/cli/common/whirlpool-opts';
import type { CliArgs } from '@/interfaces/cli';
import { getPositions } from '@/services/position/get-position';
import { info } from '@/util/log';
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
  const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
  const bundledPositions = await getPositions({ whirlpoolAddress });

  info('Positions:', bundledPositions.map((pos) => pos.position.getAddress().toBase58()));

  whirlpoolAddress
    ? info(`Retrieved ${bundledPositions.length} owned positions under whirlpool:`, whirlpoolAddress.toBase58())
    : info(`Retrieved ${bundledPositions.length} owned positions`);
}

export default cli;
