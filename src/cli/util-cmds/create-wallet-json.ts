import type { CliArgs } from '@/util/cli/cli.interfaces';
import { prompt } from '@/util/cli/cli';
import { decodeBase58, encodeBase58 } from '@/util/pki/pki';
import { error, info } from '@/util/log/log';
import { path as appRootPath } from 'app-root-path';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Argv } from 'yargs';

const cli = {
  command: 'create-wallet-json',
  description: 'Creates a wallet JSON file containing private key byte array.',
  options: {
    'out': {
      alias: 'o',
      describe: 'The output filename to write the private key to.',
      type: 'string' as const,
      default: 'wallet.json',
    },
    'private-key': {
      alias: 'pk',
      describe: 'The private key to write to the output file. Prompts if not provided.',
      type: 'string' as const,
    },
  },
  builder: (yargs: Argv) => yargs.options(cli.options),
  handler,
};

/**
 * Writes a private key byte array to a wallet JSON file.
 *
 * @param argv The CLI arguments passed to the command.
 */
export async function handler(argv: CliArgs<typeof cli.options>) {
  try {
    // get private key as raw bytes
    const privateKey = argv.privateKey ?? await prompt('privateKey(base58):');
    const privateKeyBytes = decodeBase58(privateKey.trim());

    // write file
    const outPathname = join(appRootPath, argv.out);
    await writeFile(outPathname, `[${privateKeyBytes.toString()}]`);

    // verify file
    const privateKeyBytesLoaded = await readFile(outPathname, { encoding: 'utf-8' });
    const privateKeyLoaded = encodeBase58(privateKeyBytesLoaded);
    if (privateKey === privateKeyLoaded) {
      info(`${outPathname} created successfully!`);
    }
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

export default cli;
