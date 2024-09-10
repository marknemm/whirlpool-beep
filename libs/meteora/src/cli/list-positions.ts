import type DLMM from '@meteora-ag/dlmm';
import { error, info, type CliArgs } from '@npc/core';
import { genGetPoolCliOpts, getPoolAddressFromCliArgs } from '@npc/meteora/cli/common/pool-opts';
import { formatPool, getPool } from '@npc/meteora/util/pool/pool';
import { formatPosition, getPositions, type Position } from '@npc/meteora/util/position/position';
import { green } from 'colors';
import { type Argv } from 'yargs';

const cli = {
  command: 'list-positions',
  description: 'List all position addresses.\n\n'
    + 'If pool args are provided, all positions in the pool will be listed.\n'
    + 'Otherwise, all owned positions will be listed.\n',
  options: {
    ...genGetPoolCliOpts({
      'pool': {
        description: 'The address of the Meteora DLMM pool to list all positions under',
      },
    }),
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler,
};

async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    const poolAddress = await getPoolAddressFromCliArgs(argv);
    const positions = await getPositions({ poolAddress });

    const poolPositions = new Map<DLMM, Position[]>();

    for (const position of positions) {
      const pool = await getPool({ poolAddress: position.poolPublicKey });
      if (!poolPositions.has(pool)) {
        poolPositions.set(pool, []);
      }
      poolPositions.get(pool)!.push(position);
    }

    for (const pool of poolPositions.keys()) {
      info(
        `\n${await formatPool(pool)}\n  `,
        green((await Promise.all(
          poolPositions.get(pool)!.map((position) => formatPosition(position))
        )).sort().join('\n   ')),
        `\n( count: ${poolPositions.get(pool)!.length} )\n`
      );
    }

    poolAddress
      ? info(`Retrieved ${positions.length} positions under pool:`, poolAddress.toBase58())
      : info(`Retrieved ${positions.length} total positions`);
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
