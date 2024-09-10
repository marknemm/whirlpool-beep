import { error, type CliArgs } from '@npc/core';
import { genGetPoolCliOpts, getPoolAddressFromCliArgs } from '@npc/meteora/cli/common/pool-opts';
import { genGetPositionCliOpts } from '@npc/meteora/cli/common/position-opts';
import { closeAllPositions, closePosition } from '@npc/meteora/services/close-position/close-position';
import { getPosition } from '@npc/meteora/util/position/position';
import { type Argv } from 'yargs';

const cli = {
  command: 'close-position',
  description: 'Close one or more positions.\n\n'
    + 'If pool args are provided, all positions in the Meteora DLMM pool will be closed.\n'
    + 'Otherwise, the position at the specified position address will be closed.\n',
  options: {
    ...genGetPoolCliOpts({
      'pool': {
        description: 'The address of the Meteora DLMM pool to close all positions in',
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to close',
      },
    }),
  },
  builder(yargs: Argv) {
    return yargs.options(cli.options).check((argv) => {
      if (argv.pool || argv.position) return true;
      if (argv.tokenX && argv.tokenY && argv.binStep && argv.baseFee) return true;

      throw new Error('Must provide Position, Pool, or Pool PDA options');
    });
  },
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const poolAddress = await getPoolAddressFromCliArgs(argv);

    if (poolAddress) {
      await closeAllPositions(poolAddress);
    }

    if (argv.position) {
      const position = await getPosition(argv.position);
      if (!position) throw new Error(`Position not found: ${argv.position}`);
      return await closePosition(position);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
