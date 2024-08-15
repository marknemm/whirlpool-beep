import { genGetPositionCliOpts } from '@/cli/common/position-opts';
import { genTransactionCliOpts } from '@/cli/common/transaction-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@/cli/common/whirlpool-opts';
import { emptyAllPositions, emptyPosition, genEmptyPositionIxData } from '@/services/position/empty/empty-position';
import { getPosition, getPositionAtIdx } from '@/services/position/query/query-position';
import type { CliArgs } from '@/util/cli/cli.interfaces';
import { error, info } from '@/util/log/log';
import { genComputeBudget } from '@/util/transaction-budget/transaction-budget';
import { type Position } from '@orca-so/whirlpools-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'empty',
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
        const { instructions } = await genEmptyPositionIxData(position);
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
