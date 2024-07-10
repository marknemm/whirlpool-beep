import type { DecreaseLiquidityCliArgs } from '@/interfaces/position';
import { decreaseAllLiquidity, decreaseLiquidity } from '@/services/position/decrease-liquidity';
import { getPosition, getPositionAtIdx } from '@/services/position/get-position';
import { getWhirlpoolKey } from '@/util/whirlpool';
import { PublicKey } from '@solana/web3.js';
import { type Argv } from 'yargs';
import genGetPositionOpts from '../common-opts/position-opts';
import genGetWhirlpoolOpts from '../common-opts/whirlpool-opts';

export default {
  command: 'decrease-liquidity',
  describe: 'Decrease liquidity in one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their liquidity decreased.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its liquidity decreased.',
  builder: (yargs: Argv<DecreaseLiquidityCliArgs>) =>
    yargs.options({
      ...genGetWhirlpoolOpts('decrease liquidity in'),
      ...genGetPositionOpts('decrease liquidity in'),
      'liquidity': {
        alias: 'l',
        describe: 'The amount of liquidity to decrease',
        group: 'Position',
        type: 'number',
        demandOption: true,
      },
    }).check((argv) => {
      if (argv.whirlpool || argv.position || argv.bundleIndex) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Position, Whirlpool, or Whirlpool PDA options');
    }),
  handler: collectPositionCmd,
};

async function collectPositionCmd(argv: DecreaseLiquidityCliArgs) {
  const whirlpool = argv.whirlpool
    ? new PublicKey(argv.whirlpool)
    : (argv.tokenA && argv.tokenB && argv.tickSpacing)
      ? await getWhirlpoolKey(argv.tokenA, argv.tokenB, argv.tickSpacing)
      : null;

  if (whirlpool) {
    return await decreaseAllLiquidity(whirlpool, argv.liquidity);
  }

  if (argv.position) {
    const { position } = await getPosition(argv.position);
    return await decreaseLiquidity(position, argv.liquidity);
  }

  if (argv.bundleIndex) {
    const { position } = await getPositionAtIdx(argv.bundleIndex);
    return await decreaseLiquidity(position, argv.liquidity);
  }
}
