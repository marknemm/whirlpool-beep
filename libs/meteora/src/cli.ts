import { error } from '@npc/core';
import { Config } from '@npc/meteora/util/config/config';
import { getPool } from './services/pool/query/query-pool';
import { openPosition } from './services/position/open/open-position';

/**
 * Main entry point.
 */
async function main() {
  await Config.init();

  const pool = await getPool({
    tokenA: 'SOL',
    tokenB: 'USDC',
    baseFee: 0.03,
    binStep: 2,
  });

  await openPosition({ poolAddress: pool.pubkey });

  // Execute the CLI
  // await execCli({
  //   description: 'Manage Meteora liquidity positions',
  //   commandPath: join(__dirname, 'cli'),
  //   builder: () =>
  //     yargs(process.argv.slice(2))
  //       .usage('Usage: $0 <command> [options]')
  //       .strict()
  //       .commandDir('cli', {
  //         extensions: __filename.endsWith('.js')
  //           ? ['js']
  //           : ['js', 'ts'],
  //         visit: (commandModule) => commandModule.default
  //       })
  //       .demandCommand()
  //       .options({ 'help': { alias: 'h', hidden: true } })
  //       .version(false),
  // });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
