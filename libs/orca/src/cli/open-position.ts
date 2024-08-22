import type { CliArgs } from '@npc/core';
import { error } from '@npc/core';
import { genLiquidityCliOpts } from '@npc/orca/cli/common/position-opts.js';
import { genGetWhirlpoolCliOpts, getWhirlpoolFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts.js';
import { openPosition } from '@npc/orca/services/position/open/open-position.js';
import { Percentage } from '@orca-so/common-sdk';
import { type Argv } from 'yargs';

const cli = {
  command: 'open-position',
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

    await openPosition({
      whirlpool,
      liquidity: argv.liquidity,
      liquidityUnit: argv.liquidityUnit,
      priceMargin: Percentage.fromFraction(argv.priceMargin, 100),
    });
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
