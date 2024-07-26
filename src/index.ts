import env from './util/env'; // Load and validate env variables ASAP

import { blue } from 'colors';
import { prompt, promptCliCommand, promptCliScript } from './util/cli';
import { debug, error, info } from './util/log';

/**
 * Main entry point.
 */
async function main() {
  process.env.NO_EXEC_CLI = 'true'; // Prevent command execution in CLI modules
  debug('Environment variables loaded and validated:', { ...env }, '\n');

  const { script, commandsDir } = await promptCliScript();

  const command = commandsDir
    ? await promptCliCommand(script)
    : '';

  process.argv = [process.argv[0], script, command]; // Update argv so yargs can parse it with command
  const cli = require(`./cli/${script}.ts`).default; // eslint-disable-line @typescript-eslint/no-var-requires
  const cliBuilder = cli.builder();

  const scriptCommand = `${script} ${command}`.trim();

  cliBuilder.showHelp();
  const args = await prompt(`\nInput ${blue(scriptCommand)} arguments: `);
  const argv = await cliBuilder.parse(`${command} ${args}`);

  info(`\n${blue(scriptCommand)} ${args}\n`);

  const handler = cli.handler ?? require(`./cli/${script}-cmds/${command}.ts`).default.handler; // eslint-disable-line @typescript-eslint/no-var-requires
  await handler?.(argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
