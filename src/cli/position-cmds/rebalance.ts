import { genGetPositionCliOpts, genLiquidityCliOpts } from '@/cli/common/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@/cli/common/whirlpool-opts';
import type { CliArgs } from '@/interfaces/cli';
import type { RebalanceAllPositionsOptions } from '@/interfaces/position';
import { getPosition, getPositionAtIdx } from '@/services/position/get-position';
import { genPriceRangeRebalanceFilter, rebalanceAllPositions, rebalancePosition } from '@/services/position/rebalance-position';
import { Percentage } from '@orca-so/common-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'rebalance',
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
        demandOption: true,
      },
    }),
    'price-range-margin': {
      alias: 'm',
      describe: 'The price range margin percentage to use as a criteria for rebalancing; between 0 and 100',
      group: 'Rebalance',
      type: 'number' as const,
      default: 20,
    }
  },
  builder(yargs: Argv) {
    return yargs.options(cli.options).check((argv) => {
      if (argv.whirlpool || argv.position || argv.bundleIndex) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Position, Whirlpool, or Whirlpool PDA options');
    });
  },
  handler
};

async function handler(argv: CliArgs<typeof cli.options>) {
  const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);

  const rebalanceOptions: RebalanceAllPositionsOptions = {
    whirlpoolAddress,
    liquidity: argv.liquidity,
    liquidityUnit: argv.liquidityUnit,
    filter: genPriceRangeRebalanceFilter(
      Percentage.fromFraction(argv.priceRangeMargin, 100)
    )
  };

  if (whirlpoolAddress) {
    await rebalanceAllPositions(rebalanceOptions);
  } else {
    const bundledPosition = argv.position
      ? await getPosition(argv.position)
      : await getPositionAtIdx(argv.bundleIndex!);

    await rebalancePosition(bundledPosition, rebalanceOptions);
  }
}

export default cli;
