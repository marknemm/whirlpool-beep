import whirlpoolOpts from '@/cli/common-opts/whirlpool-opts';
import type { OpenPositionCliArgs } from '@/interfaces/position';
import { increaseLiquidity } from '@/services/position/increase-liquidity';
import { openPosition } from '@/services/position/open-position';
import whirlpoolClient, { getWhirlpool } from '@/util/whirlpool';
import { Percentage } from '@orca-so/common-sdk';
import { type Argv } from 'yargs';

export default {
  command: 'open',
  describe: 'Open a new position in a whirlpool with an optional initial liquidity amount.',
  builder: (yargs: Argv<OpenPositionCliArgs>) =>
    yargs.options({
      ...whirlpoolOpts('The address of the whirlpool to open a position in'),
      'price-margin': {
        alias: 'm',
        describe: 'The price margin percentage to use for the position; between 0 and 100',
        group: 'Position',
        type: 'number',
        default: 3,
      },
      'liquidity': {
        alias: 'l',
        describe: 'The amount of liquidity to initially provide',
        group: 'Position',
        type: 'number',
      },
      'liquidity-unit': {
        alias: 'u',
        describe: 'The unit to use for the liquidity amount',
        defaultDescription: 'tokenB',
        group: 'Position',
        choices: ['liquidity', 'tokenA', 'tokenB'],
        implies: ['liquidity'],
      }
    }).check((argv) => {
      if (argv.whirlpool) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Whirlpool or Whirlpool PDA options.');
    }),
  handler: openPositionCmd,
};

async function openPositionCmd(argv: OpenPositionCliArgs) {
  const whirlpool = argv.whirlpool
    ? await whirlpoolClient().getPool(argv.whirlpool)
    : await getWhirlpool(argv.tokenA!, argv.tokenB!, argv.tickSpacing!);

  const { position } = await openPosition(whirlpool, Percentage.fromFraction(argv.priceMargin, 100));
  if (argv.liquidity) {
    await increaseLiquidity(position, argv.liquidity, argv.liquidityUnit);
  }
}
