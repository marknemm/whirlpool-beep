import { genLiquidityCliOpts } from '@/cli/common/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolFromCliArgs } from '@/cli/common/whirlpool-opts';
import type { CliArgs } from '@/util/cli/cli.interfaces';
import { increaseLiquidity } from '@/services/liquidity/increase/increase-liquidity';
import { openPosition } from '@/services/position/open/open-position';
import { error } from '@/util/log/log';
import { Percentage } from '@orca-so/common-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'open',
  description: 'Open a new position in a whirlpool with an optional initial liquidity amount.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The whirlpool to open a position in',
      },
    }),
    'price-margin': {
      alias: 'm',
      describe: 'The price margin percentage to use for the position; between 0 and 100',
      group: 'Position',
      type: 'number' as const,
      default: 3,
    },
    ...genLiquidityCliOpts({
      'liquidity': {
        describe: 'The amount of liquidity to initially provide',
      }
    }),
  },
  builder(yargs: Argv) {
    return yargs.options(cli.options).check((argv) => {
      if (argv.whirlpool) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Whirlpool or Whirlpool PDA options');
    });
  },
  handler
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const whirlpool = await getWhirlpoolFromCliArgs(argv);
    if (!whirlpool) throw new Error('Whirlpool not found');

    const { bundledPosition } = await openPosition({
      whirlpool,
      priceMargin: Percentage.fromFraction(argv.priceMargin, 100),
    });
    if (argv.liquidity) {
      await increaseLiquidity(bundledPosition.position, argv.liquidity, argv.liquidityUnit);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
