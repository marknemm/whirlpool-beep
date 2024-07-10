import genGetPositionOpts from '@/cli/common-opts/position-opts';
import genGetWhirlpoolOpts from '@/cli/common-opts/whirlpool-opts';
import type { IncreaseLiquidityCmdArgs } from '@/interfaces/position';
import { getPosition, getPositionAtIdx } from '@/services/position/get-position';
import { increaseAllLiquidity, increaseLiquidity } from '@/services/position/increase-liquidity';
import { getWhirlpoolKey } from '@/util/whirlpool';
import { PublicKey } from '@solana/web3.js';
import { type Argv } from 'yargs';

export default {
  command: 'increase-liquidity',
  describe: 'Increase liquidity of one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their liquidity increased.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its liquidity increased.',
  builder: (yargs: Argv<IncreaseLiquidityCmdArgs>) =>
    yargs.options({
      ...genGetWhirlpoolOpts('increase liquidity in'),
      ...genGetPositionOpts('increase liquidity in'),
      'liquidity': {
        alias: 'l',
        describe: 'The amount of liquidity to increase',
        group: 'Position',
        type: 'number',
        demandOption: true,
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
      if (argv.whirlpool || argv.position || argv.bundleIndex) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Position, Whirlpool, or Whirlpool PDA options');
    }),
  handler: increaseLiquidityCmd,
};

async function increaseLiquidityCmd(argv: IncreaseLiquidityCmdArgs) {
  const whirlpool = argv.whirlpool
    ? new PublicKey(argv.whirlpool)
    : (argv.tokenA && argv.tokenB && argv.tickSpacing)
      ? await getWhirlpoolKey(argv.tokenA, argv.tokenB, argv.tickSpacing)
      : null;

  if (whirlpool) {
    return await increaseAllLiquidity(whirlpool, argv.liquidity, argv.liquidityUnit);
  }

  if (argv.position) {
    const { position } = await getPosition(argv.position);
    return await increaseLiquidity(position, argv.liquidity, argv.liquidityUnit);
  }

  if (argv.bundleIndex) {
    const { position } = await getPositionAtIdx(argv.bundleIndex);
    return await increaseLiquidity(position, argv.liquidity, argv.liquidityUnit);
  }
}
