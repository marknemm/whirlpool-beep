import genGetPositionOpts from '@/cli/common-opts/position-opts';
import genGetWhirlpoolOpts from '@/cli/common-opts/whirlpool-opts';
import type { CollectPositionCliArgs } from '@/interfaces/position';
import { collectAllFeesRewards, collectFeesRewards } from '@/services/position/collect-fees-rewards';
import { getPosition, getPositionAtIdx } from '@/services/position/get-position';
import { getWhirlpoolKey } from '@/util/whirlpool';
import { PublicKey } from '@solana/web3.js';
import { type Argv } from 'yargs';

export default {
  command: 'collect',
  describe: 'Collect rewards from one or more positions.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will have their rewards collected.\n'
    + 'Otherwise, the position at the specified bundle index or position address will have its rewards collected.',
  builder: (yargs: Argv<CollectPositionCliArgs>) =>
    yargs.options({
      ...genGetWhirlpoolOpts('collect fees & rewards from'),
      ...genGetPositionOpts('collect fees & rewards from'),
    }),
  handler: collectPositionCmd,
};

async function collectPositionCmd(argv: CollectPositionCliArgs) {
  const whirlpool = argv.whirlpool
    ? new PublicKey(argv.whirlpool)
    : (argv.tokenA && argv.tokenB && argv.tickSpacing)
      ? await getWhirlpoolKey(argv.tokenA, argv.tokenB, argv.tickSpacing)
      : null;

  if (whirlpool) {
    return await collectAllFeesRewards(whirlpool);
  }

  if (argv.position) {
    const { position } = await getPosition(argv.position);
    return await collectFeesRewards(position);
  }

  if (argv.bundleIndex) {
    const { position } = await getPositionAtIdx(argv.bundleIndex);
    return await collectFeesRewards(position);
  }
}
