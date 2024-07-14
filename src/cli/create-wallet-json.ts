import { CliArgs } from '@/interfaces/cli';
import { prompt } from '@/util/cli';
import { decodeBase58, encodeBase58 } from '@/util/encode';
import { error, info } from '@/util/log';
import { path as appRootPath } from 'app-root-path';
import { readFile, writeFile } from 'node:fs/promises';
import yargs from 'yargs';

const cli = {
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
  builder: () =>
    yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .options(cli.options),
  handler,
};

/**
 * Writes a private key byte array to a wallet JSON file.
 *
 * @param argv The CLI arguments passed to the command.
 */
export async function handler(argv?: CliArgs<typeof cli.options>) {
  argv ??= await cli.builder().parse();

  // get private key as raw bytes
  const privateKey = argv.privateKey ?? await prompt('privateKey(base58):');
  const privateKeyBytes = decodeBase58(privateKey.trim());

  // write file
  const outPathname = `${appRootPath}/${argv.out}`;
  await writeFile(outPathname, `[${privateKeyBytes.toString()}]`);

  // verify file
  const privateKeyBytesLoaded = await readFile(outPathname, { encoding: 'utf-8' });
  const privateKeyLoaded = encodeBase58(privateKeyBytesLoaded);
  if (privateKey === privateKeyLoaded) {
    info(`${outPathname} created successfully!`);
  }
}

if (process.env.NO_EXEC_CLI !== 'true') {
  handler()
    .then(() => process.exit(0))
    .catch((err) => {
      error(err);
      process.exit(1);
    });
}

export default cli;
