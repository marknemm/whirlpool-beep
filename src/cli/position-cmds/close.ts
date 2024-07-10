import genGetWhirlpoolOpts from '@/cli/common-opts/whirlpool-opts';
import type { ClosePositionCliArgs } from '@/interfaces/position';
import { closeAllPositions, closePosition } from '@/services/position/close-position';
import { getPosition, getPositionAtIdx } from '@/services/position/get-position';
import { getWhirlpoolKey } from '@/util/whirlpool';
import { PublicKey } from '@solana/web3.js';
import { type Argv } from 'yargs';
import genGetPositionOpts from '../common-opts/position-opts';

export default {
  command: 'close',
  describe: 'Close one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be closed.\n'
    + 'Otherwise, the position at the specified bundle index or position address will be closed.',
  builder: (yargs: Argv<ClosePositionCliArgs>) =>
    yargs.options({
      ...genGetWhirlpoolOpts('close all positions in'),
      ...genGetPositionOpts('close'),
    }).check((argv) => {
      if (argv.whirlpool || argv.position || argv.bundleIndex) return true;
      if (argv.tokenA && argv.tokenB && argv.tickSpacing) return true;

      throw new Error('Must provide Position, Whirlpool, or Whirlpool PDA options');
    }),
  handler: openPositionCmd,
};

async function openPositionCmd(argv: ClosePositionCliArgs) {
  const whirlpool = argv.whirlpool
    ? new PublicKey(argv.whirlpool)
    : (argv.tokenA && argv.tokenB && argv.tickSpacing)
      ? await getWhirlpoolKey(argv.tokenA, argv.tokenB, argv.tickSpacing)
      : null;

  if (whirlpool) {
    return await closeAllPositions(whirlpool);
  }

  if (argv.position) {
    const bundledPosition = await getPosition(argv.position);
    return await closePosition(bundledPosition);
  }

  if (argv.bundleIndex) {
    const bundledPosition = await getPositionAtIdx(argv.bundleIndex);
    return await closePosition(bundledPosition);
  }
}
