import { error, type CliArgs } from '@npc/core';
import { genGetPositionCliOpts, genLiquidityCliOpts } from '@npc/orca/cli/common/position-opts';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { increaseAllLiquidity, increaseLiquidity } from '@npc/orca/services/increase-liquidity/increase-liquidity';
import { getPosition, getPositionAtIdx } from '@npc/orca/util/position/position';
import { type Argv } from 'yargs';

const cli = {
  command: 'increase-liquidity',
  description: 'Increase liquidity of one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their liquidity increased.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its liquidity increased.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to increase liquidity in',
      },
    }),
    ...genGetPositionCliOpts({
      'position': {
        description: 'The address of the position to increase liquidity in',
      },
      'bundle-index': {
        description: 'The bundle index of the position to increase liquidity in',
      }
    }),
    ...genLiquidityCliOpts({
      'liquidity': {
        describe: 'The amount of liquidity to increase',
        demandOption: true,
      }
    }),
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
  try {
    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);

    if (whirlpoolAddress) {
      return await increaseAllLiquidity(whirlpoolAddress, argv.liquidity, argv.liquidityUnit);
    }

    if (argv.position) {
      const { position } = await getPosition(argv.position);
      return await increaseLiquidity(position, argv.liquidity, argv.liquidityUnit);
    }

    if (argv.bundleIndex) {
      const { position } = await getPositionAtIdx(argv.bundleIndex);
      return await increaseLiquidity(position, argv.liquidity, argv.liquidityUnit);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
