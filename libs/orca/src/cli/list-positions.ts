import { error, info, type CliArgs } from '@npc/core';
import { genGetWhirlpoolCliOpts, getWhirlpoolAddressFromCliArgs } from '@npc/orca/cli/common/whirlpool-opts';
import { formatPosition, getPositions, type BundledPosition } from '@npc/orca/util/position/position';
import { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { WhirlpoolData } from '@orca-so/whirlpools-sdk';
import { green } from 'colors';
import { type Argv } from 'yargs';

const cli = {
  command: 'list-positions',
  description: 'List all position addresses.\n\n'
    + 'If whirlpool args are provided, all positions in the whirlpool will be listed.\n'
    + 'Otherwise, all owned positions will be listed.\n',
  options: {
    ...genGetWhirlpoolCliOpts({
      'whirlpool': {
        description: 'The address of the whirlpool to list all positions under',
      },
    }),
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const whirlpoolAddress = await getWhirlpoolAddressFromCliArgs(argv);
    const bundledPositions = await getPositions({ whirlpoolAddress });

    const whirlpoolPositions = new Map<WhirlpoolData, BundledPosition[]>();

    for (const bundledPosition of bundledPositions) {
      const whirlpoolData = bundledPosition.position.getWhirlpoolData();
      if (!whirlpoolPositions.has(whirlpoolData)) {
        whirlpoolPositions.set(whirlpoolData, []);
      }
      whirlpoolPositions.get(whirlpoolData)!.push(bundledPosition);
    }

    for (const whirlpoolData of whirlpoolPositions.keys()) {
      info(
        `\n${await formatWhirlpool(whirlpoolData)}\n  `,
        green((await Promise.all(
          whirlpoolPositions.get(whirlpoolData)!.map((bundledPosition) => formatPosition(bundledPosition))
        )).sort().join('\n   ')),
        `\n( count: ${whirlpoolPositions.get(whirlpoolData)!.length} )\n`
      );
    }

    whirlpoolAddress
      ? info(`Retrieved ${bundledPositions.length} positions under whirlpool:`, whirlpoolAddress.toBase58())
      : info(`Retrieved ${bundledPositions.length} total positions`);
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
