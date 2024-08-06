import env from '@/util/env/env'; // Load and validate env variables ASAP

import { prompt, promptCliCommand, promptCliScript } from '@/util/cli/cli';
import { migrateDb } from '@/util/db/db';
import { debug, error, info } from '@/util/log/log';
import { blue } from 'colors';
import { join } from 'node:path';

/**
 * Main entry point.
 */
async function main() {
  process.env.NO_EXEC_CLI = 'true'; // Prevent command execution in CLI modules
  debug('Environment variables loaded and validated:', { ...env }, '\n');

  // Migrate the database if the DB_MIGRATE env variable is set
  if (env.DB_MIGRATE) {
    await migrateDb();
  }

  const { script, commandsDir } = await promptCliScript();

  const command = commandsDir
    ? await promptCliCommand(script)
    : '';

  // Update argv so yargs can parse it when loading the CLI module
  process.argv = [process.argv[0], script, command];

  // Load the CLI module
  const cliPathname = join(__dirname, 'cli', `${script}.ts`);
  const cli = (await import(cliPathname)).default;
  const cliBuilder = cli.builder();

  // Show help for CLI command, prompt for arguments, and parse them
  cliBuilder.showHelp();
  const scriptCommand = `${script} ${command}`.trim();
  const args = await prompt(`\nInput ${blue(scriptCommand)} arguments: `);
  const argv = await cliBuilder.parse(`${command} ${args}`);

  // Execute the CLI command
  info(`\n${blue(scriptCommand)} ${args}\n`);
  const cmdPathname = join(__dirname, 'cli', `${script}-cmds`, `${command}.ts`);
  const handler = cli.handler ?? (await import(cmdPathname)).default.handler;
  await handler?.(argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
