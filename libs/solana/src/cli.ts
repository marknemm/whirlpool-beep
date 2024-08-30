
import { error, execCli } from '@npc/core';
import Config from '@npc/solana/util/config/config';
import { join } from 'node:path';
import yargs from 'yargs';

/**
 * Main entry point.
 */
async function main() {
  await Config.init();

  // Execute the CLI
  await execCli({
    description: 'Solana utility commands',
    commandPath: join(__dirname, 'cli'),
    builder: () =>
      yargs(process.argv.slice(2))
        .usage('Usage: $0 <command> [options]')
        .strict()
        .commandDir('cli', {
          extensions:  __filename.endsWith('.js')
            ? ['js']
            : ['js', 'ts'],
          visit: (commandModule) => commandModule.default
        })
        .demandCommand()
        .options({ 'help': { alias: 'h', hidden: true } })
        .version(false),
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
