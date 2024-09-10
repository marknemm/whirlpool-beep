import { error, type CliArgs } from '@npc/core';
import { genGetPoolCliOpts, getPoolAddressFromCliArgs } from '@npc/meteora/cli/common/pool-opts';
import { genLiquidityCliOpts } from '@npc/meteora/cli/common/position-opts';
import { openPosition } from '@npc/meteora/services/open-position/open-position';
import Decimal from 'decimal.js';
import { type Argv } from 'yargs';

const cli = {
  command: 'open-position',
  description: 'Open a new position in a Meteora DLMM pool with an optional initial liquidity amount.\n',
  options: {
    ...genGetPoolCliOpts({
      'pool': {
        description: 'The Meteora DLMM pool to open a position in',
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
      if (argv.pool) return true;
      if (argv.tokenX && argv.tokenY && argv.binStep && argv.baseFee) return true;

      throw new Error('Must provide Pool or Pool PDA options');
    });
  },
  handler
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const { liquidity, liquidityUnit, priceMargin } = argv;

    const poolAddress = await getPoolAddressFromCliArgs(argv);
    if (!poolAddress) throw new Error('Meteora DLMM pool not found');

    await openPosition({
      poolAddress,
      liquidity,
      liquidityUnit,
      priceMargin: new Decimal(priceMargin).div(100),
    });
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
