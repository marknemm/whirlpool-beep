import { genGetPositionCliOpts } from '@/cli/common/position-opts';
import { genTransactionCliOpts } from '@/cli/common/transaction-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@/cli/common/whirlpool-opts';
import type { CliArgs } from '@/util/cli/cli.interfaces';
import { collectAllFeesRewards, collectFeesRewards, genCollectFeesRewardsTx } from '@/services/fees-rewards/collect/collect-fees-rewards';
import { getPosition, getPositionAtIdx } from '@/services/position/query/query-position';
import { error, info } from '@/util/log/log';
import { genComputeBudget } from '@/util/transaction-budget/transaction-budget';
import { type Position } from '@orca-so/whirlpools-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'collect',
  description: 'Collect rewards from one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their rewards collected.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its rewards collected.\n',
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
    ...genTransactionCliOpts()
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    let position: Position | undefined;

    if (argv.position) {
      ({ position } = await getPosition(argv.position));
    }

    if (argv.bundleIndex) {
      ({ position } = await getPositionAtIdx(argv.bundleIndex));
    }

    if (position) {
      if (argv.dryRun) {
        const { tx } = await genCollectFeesRewardsTx(position);
        const computeBudget = await genComputeBudget(tx);
        info('Transaction budget:', computeBudget);
      } else {
        await collectFeesRewards(position);
      }
    } else {
      const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
      await collectAllFeesRewards(whirlpoolAddress);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
