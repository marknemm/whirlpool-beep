import { error, type CliArgs } from '@npc/core';
import { genGetPositionCliOpts } from '@npc/orca/cli/common/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { closeAllPositions, closePosition } from '@npc/orca/services/close-position/close-position';
import { getPosition, getPositionAtIdx } from '@npc/orca/util/position/position';
import { type Argv } from 'yargs';

const cli = {
  command: 'close-position',
  description: 'Close one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be closed.\n'
    + 'Otherwise, the position at the specified bundle index or position address will be closed.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to close all positions in',
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to close',
      },
      'bundle-index': {
        description: 'The bundle index of the position to close',
      }
    }),
  },
  builder(yargs: Argv) {
    return yargs.options(cli.options).check((argv) => {
      if (argv.whirlpool || argv.position || argv.bundleIndex) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Position, Whirlpool, or Whirlpool PDA options');
    });
  },
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);

    if (whirlpoolAddress) {
      await closeAllPositions(whirlpoolAddress);
    }

    if (argv.position) {
      const bundledPosition = await getPosition(argv.position);
      return await closePosition({ bundledPosition });
    }

    if (argv.bundleIndex) {
      const bundledPosition = await getPositionAtIdx(argv.bundleIndex);
      return await closePosition({ bundledPosition });
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
