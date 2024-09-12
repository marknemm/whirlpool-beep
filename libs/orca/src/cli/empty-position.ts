import { error, info, type CliArgs } from '@npc/core';
import { genGetPositionCliOpts } from '@npc/orca/cli/common/position-opts';
import { genTransactionCliOpts } from '@npc/orca/cli/common/transaction-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { emptyAllPositions, emptyPosition, genEmptyPositionIxSet } from '@npc/orca/services/empty-position/empty-position';
import { getPosition, getPositionAtIdx } from '@npc/orca/util/position/position';
import { genComputeBudget } from '@npc/solana';
import { type Position } from '@orca-so/whirlpools-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'empty-position',
  description:
      'Empty one or more positions. This involves decreasing liquidity to zero and collecting all fees and rewards\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be emptied.\n'
    + 'Otherwise, the position at the specified bundle index or position address will be emptied.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to empty all positions in',
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to empty',
      },
      'bundle-index': {
        description: 'The bundle index of the position to empty',
      }
    }),
    ...genTransactionCliOpts()
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
    let position: Position | undefined;

    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
    if (whirlpoolAddress) {
      if (argv.dryRun) throw new Error('Dry run not supported for emptying multiple positions');
      return await emptyAllPositions(whirlpoolAddress);
    }

    if (argv.position) {
      ({ position } = await getPosition(argv.position));
    }
    if (argv.bundleIndex) {
      ({ position } = await getPositionAtIdx(argv.bundleIndex));
    }

    if (position) {
      if (argv.dryRun) {
        const { instructions } = await genEmptyPositionIxSet(position);
        const computeBudget = await genComputeBudget(instructions);
        info('Transaction budget:', computeBudget);
      } else {
        await emptyPosition(position);
      }
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
