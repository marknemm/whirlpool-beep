import genWhirlpoolOpts from '@/cli/common-opts/whirlpool-opts';
import type { ClosePositionCliArgs } from '@/interfaces/position';
import { closeAllPositions, closePosition } from '@/services/position/close-position';
import { getBundledPosition } from '@/services/position/get-position';
import { getWhirlpoolKey } from '@/util/whirlpool';
import { PublicKey } from '@solana/web3.js';
import { type Argv } from 'yargs';

export default {
  command: 'close',
  describe: 'Close one or more position(s).\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be closed.\n'
    + 'Otherwise, the position at the specified bundle index or position address will be closed.',
  builder: (yargs: Argv<ClosePositionCliArgs>) =>
    yargs.options({
      ...genWhirlpoolOpts('The address of the whirlpool to close all positions in'),
      'bundle-index': {
        alias: 'i',
        describe: 'The bundle index of the position to close',
        group: 'Position',
        type: 'number',
        conflicts: ['position', 'whirlpool', 'token-a', 'token-b', 'tick-spacing']
      }
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

  if (argv.bundleIndex) {
    const bundledPosition = await getBundledPosition(argv.bundleIndex);
    return await closePosition(bundledPosition);
  }
}
