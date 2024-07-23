import env from '@/util/env';
import { path as appRootPath } from 'app-root-path';
import { glob } from 'glob';
import { createInterface } from 'node:readline/promises';
import prompts from 'prompts';

/**
 * Prompts the user to choose a CLI script to run.
 *
 * @returns A {@link Promise} that resolves to the name of the script to run.
 */
export async function promptCliScript(): Promise<{ script: string, commandsDir: string }> {
  const cliScripts = (await glob(`${appRootPath}/src/cli/*.ts`, { withFileTypes: false }))
    .map((path) => path.split('/').pop()!.replace('.ts', ''))
    .sort();

  const { script } = await prompts({
    type: 'select',
    name: 'script',
    message: 'Choose a CLI script to run',
    choices: cliScripts.map((script) => ({
      title: script,
      description: require(`@/cli/${script}`).default.description, // eslint-disable-line @typescript-eslint/no-var-requires
      value: script,
    })),
  });

  const [commandsDir] = await glob(`${appRootPath}/src/cli/${script}-cmds`, { withFileTypes: false });

  return { script, commandsDir };
}

/**
 * Prompts the user to choose a CLI command to run.
 *
 * @param script The name of the script to choose a command for.
 * @returns A {@link Promise} that resolves to the name of the command to run.
 */
export async function promptCliCommand(script: string): Promise<string> {
  const cliCommands = (await glob(`${appRootPath}/src/cli/${script}-cmds/*.ts`, { withFileTypes: false }))
    .map((path) => path.split('/').pop()!.replace('.ts', ''))
    .filter((cmd) => env.NODE_ENV === 'development' || cmd !== 'airdrop')
    .sort();

  const { command } = await prompts({
    type: 'select',
    name: 'command',
    message: 'Choose a CLI command to run',
    choices: cliCommands.map((command) => ({
      title: command,
      description: require(`@/cli/${script}-cmds/${command}`).default.description, // eslint-disable-line @typescript-eslint/no-var-requires
      value: command,
    })),
  });

  return command;
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
