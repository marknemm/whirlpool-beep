import { error, type CliArgs } from '@npc/core';
import { genGetPositionCliOpts, genLiquidityCliOpts } from '@npc/orca/cli/common/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { decreaseAllLiquidity, decreaseLiquidity } from '@npc/orca/services/liquidity/decrease/decrease-liquidity';
import { getPosition, getPositionAtIdx } from '@npc/orca/services/position/query/query-position';
import { type Argv } from 'yargs';

const cli = {
  command: 'decrease-liquidity',
  description: 'Decrease liquidity in one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their liquidity decreased.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its liquidity decreased.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to decrease liquidity in',
        implies: ['liquidity'],
        conflicts: ['zero'],
      },
      'token-a': {
        implies: ['liquidity'],
        conflicts: ['zero'],
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to decrease liquidity in',
      },
      'bundle-index': {
        description: 'The bundle index of the position to decrease liquidity in',
      }
    }),
    ...genLiquidityCliOpts({
      'liquidity': {
        describe: 'The amount of liquidity to decrease',
        conflicts: ['zero'],
      },
      'liquidity-unit': {
        hidden: true, // Hide this option from the help menu - unit is locked to 'liquidity'
      }
    }),
    'zero': {
      alias: 'z',
      describe: 'Decrease liquidity to zero',
      group: 'Liquidity',
      type: 'boolean' as const,
      defaultDescription: 'false',
      conflicts: ['liquidity', 'whirlpool', 'token-a', 'token-b', 'tick-spacing'],
    },
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
    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);

    if (whirlpoolAddress) {
      return await decreaseAllLiquidity(whirlpoolAddress, argv.liquidity!);
    }

    if (argv.position) {
      const { position } = await getPosition(argv.position);
      const liquidity = argv.zero ? position.getData().liquidity : argv.liquidity;
      return await decreaseLiquidity(position, liquidity!);
    }

    if (argv.bundleIndex) {
      const { position } = await getPositionAtIdx(argv.bundleIndex);
      const liquidity = argv.zero ? position.getData().liquidity : argv.liquidity;
      return await decreaseLiquidity(position, liquidity!);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
