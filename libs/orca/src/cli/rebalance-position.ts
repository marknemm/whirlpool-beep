import { error, type CliArgs } from '@npc/core';
import { genGetPositionCliOpts, genLiquidityCliOpts } from '@npc/orca/cli/common/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { getPosition, getPositionAtIdx } from '@npc/orca/services/position/query/query-position';
import { genPriceRangeRebalanceFilter, rebalanceAllPositions, rebalancePosition } from '@npc/orca/services/position/rebalance/rebalance-position';
import type { RebalanceAllPositionsOptions } from '@npc/orca/services/position/rebalance/rebalance-position.interfaces';
import { Percentage } from '@orca-so/common-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'rebalance-position',
  description: 'Rebalance one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be rebalanced.\n'
    + 'Otherwise, the position at the specified bundle index or position address will be rebalanced.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to rebalance all positions in',
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to rebalance',
      },
      'bundle-index': {
        description: 'The bundle index of the position to rebalance',
      }
    }),
    ...genLiquidityCliOpts({
      'liquidity': {
        describe: 'The amount of liquidity to deposit into the position if rebalancing is required',
      },
    }),
    'price-range-margin': {
      alias: 'm',
      describe: 'The price range margin percentage to use as a criteria for rebalancing; between 0 and 100',
      group: 'Rebalance',
      type: 'number' as const,
      default: 20,
    },
    'force': {
      alias: 'f',
      describe: 'Force rebalance even if the position does not meet the criteria for rebalancing',
      group: 'Rebalance',
      type: 'boolean' as const,
      default: false,
    }
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler
};

async function handler(argv: CliArgs<typeof cli.options>) {
  const priceRangeFilter = genPriceRangeRebalanceFilter(
    Percentage.fromFraction(argv.priceRangeMargin, 100)
  );
  const filter = argv.force
    ? async () => true
    : priceRangeFilter;

  try {
    const rebalanceOptions: RebalanceAllPositionsOptions = {
      whirlpoolAddress: await getWhirlpoolAddressFromCliArgs(argv),
      liquidity: argv.liquidity,
      liquidityUnit: argv.liquidityUnit,
      filter,
    };

    if (argv.bundleIndex || argv.position) {
      const bundledPosition = argv.position
        ? await getPosition(argv.position)
        : await getPositionAtIdx(argv.bundleIndex!);

      await rebalancePosition(bundledPosition, rebalanceOptions);
    } else {
      await rebalanceAllPositions(rebalanceOptions);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
