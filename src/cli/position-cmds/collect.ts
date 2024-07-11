import { genGetPositionCliOpts } from '@/cli/common-opts/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@/cli/common-opts/whirlpool-opts';
import type { CliArgs } from '@/interfaces/cli';
import { collectAllFeesRewards, collectFeesRewards } from '@/services/position/collect-fees-rewards';
import { getPosition, getPositionAtIdx } from '@/services/position/get-position';
import { type Argv } from 'yargs';

const cli = {
  command: 'collect',
  describe: 'Collect rewards from one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their rewards collected.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its rewards collected.',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to collect all position fees & rewards from',
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to collect fees & rewards from',
      },
      'bundle-index': {
        description: 'The bundle index of the position to collect fees & rewards from',
      }
    }),
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  if (argv.position) {
    const { position } = await getPosition(argv.position);
    return await collectFeesRewards(position);
  }

  if (argv.bundleIndex) {
    const { position } = await getPositionAtIdx(argv.bundleIndex);
    return await collectFeesRewards(position);
  }

  const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
  return await collectAllFeesRewards(whirlpoolAddress);
}

export default cli;
