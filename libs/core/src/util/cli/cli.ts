import env from '@npc/core/util/env/env.js';
import { info } from '@npc/core/util/log/log.js';
import colors from 'colors';
import { glob } from 'glob';
import { join, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import prompts from 'prompts';
import type { Cli } from './cli.interfaces.js';

/**
 * Executes a CLI command while prompting the user for input if not provided.
 *
 * @param cli The {@link Cli} configuration.
 * @returns A {@link Promise} that resolves once the CLI command has been executed.
 */
export async function execCli(cli: Cli): Promise<void> {
  let command = process.argv[2];

  // If no CLI command and arguments are provided, prompt the user
  if (process.argv.length < 3) {
    // Prompt the user to choose a CLI command to run
    command = await promptCliCommand(cli.commandPath);
    if (!command) throw new Error(`No CLI command chosen from: ${cli.commandPath}`);

    // Update argv so yargs can parse it when loading the CLI module
    process.argv = [...process.argv, command];

    // Show help for CLI command, prompt for arguments, and update argv with them
    cli.builder().showHelp();
    const args = await prompt(`\nInput ${colors.blue(command)} arguments: `);
    process.argv = [...process.argv, ...args.split(/\s+/)];
  }

  // Parse the CLI command and arguments
  const argv = await cli.builder().parse();
  info(`\n${colors.blue(command)} ${process.argv.slice(3)}\n`);

  // Execute the CLI command
  const cmdPathname = join(cli.commandPath, `${command}.ts`);
  const handler = (await import(cmdPathname)).default.handler;
  await handler?.(argv);
}

/**
 * Prompts the user to choose a CLI command to run.
 *
 * @param cmdDir The directory containing the CLI commands.
 * @returns A {@link Promise} that resolves to the name of the command to run.
 */
export async function promptCliCommand(cmdDir: string): Promise<string> {
  const cliCommands = (await glob(`${cmdDir}/*.ts`, { withFileTypes: false }))
    .map((path) => path.split(sep).pop()!.replace(/(\.d)?\.ts/, ''))
    .filter((cmd) => env.NODE_ENV === 'development' || cmd !== 'airdrop')
    .sort();

  if (cliCommands.length > 0) {
    const answer = await prompts({
      type: 'select',
      name: 'command',
      message: 'Choose a CLI command to run',
      choices: await Promise.all(cliCommands.map(async (command) => ({
        title: command,
        description: (await import(`${cmdDir}/${command}.js`)).default.description,
        value: command,
      }))),
    });
    return answer.command;
  }

  throw new Error(`No CLI commands found: ${cmdDir}`);
}

/**
 * Prompts the user for a single line of CLI input.
 *
 * @param question The question to ask the user.
 * @returns A {@link Promise} that resolves to the user's input.
 */
export async function prompt(question: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const userInput = await readline.question(question);
  readline.close();
  return userInput;
}

export type * from './cli.interfaces.js';
