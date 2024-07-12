import { createInterface } from 'node:readline/promises';

/**
 * Prompts the user for a single line of CLI input.
 *
 * @param question The question to ask the user.
 * @returns A {@link Promise} that resolves to the user's input.
 */
export default async function prompt(question: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const userInput = await readline.question(question);
  readline.close();
  return userInput;
}
