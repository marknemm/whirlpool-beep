import { error, info, type CliArgs } from '@npc/core';
import { genGetPositionCliOpts } from '@npc/orca/cli/common/position-opts';
import { genTransactionCliOpts } from '@npc/orca/cli/common/transaction-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { collectAllFeesRewards, collectFeesRewards, genCollectFeesRewardsIxData } from '@npc/orca/services/fees-rewards/collect/collect-fees-rewards';
import { getPosition, getPositionAtIdx } from '@npc/orca/services/position/query/query-position';
import { genComputeBudget } from '@npc/solana';
import { type Position } from '@orca-so/whirlpools-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'collect-position',
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

    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
    if (whirlpoolAddress) {
      if (argv.dryRun) throw new Error('Dry run not supported for collecting from multiple positions');
      return await collectAllFeesRewards(whirlpoolAddress);
    }

    if (argv.position) {
      ({ position } = await getPosition(argv.position));
    }
    if (argv.bundleIndex) {
      ({ position } = await getPositionAtIdx(argv.bundleIndex));
    }

    if (position) {
      if (argv.dryRun) {
        const { instructions } = await genCollectFeesRewardsIxData(position);
        const computeBudget = await genComputeBudget(instructions);
        info('Transaction budget:', computeBudget);
      } else {
        await collectFeesRewards(position);
      }
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
