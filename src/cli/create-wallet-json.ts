import prompt from '@/cli/common/prompt';
import { decodeBase58, encodeBase58 } from '@/util/encode';
import { error, info } from '@/util/log';
import { path as appRootPath } from 'app-root-path';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import yargs from 'yargs';

const argv = yargs(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .options({
    'out': {
      alias: 'o',
      describe: 'The output filename to write the private key to.',
      type: 'string',
      default: 'wallet.json',
    },
    'private-key': {
      alias: 'pk',
      describe: 'The private key to write to the output file. Prompts if not provided.',
      type: 'string',
    }
  }).parseSync();

async function main() {
  const privateKey = argv.privateKey ?? await prompt('privateKey(base58):');
  const privateKeyBytes = decodeBase58(privateKey.trim());

  // write file
  const outPathname = `${appRootPath}/${argv.out}`;
  writeFile(outPathname, `[${privateKeyBytes.toString()}]`);

  // verify file
  const privateKeyBytesLoaded = readFileSync(outPathname, { encoding: 'utf-8' });
  const privateKeyLoaded = encodeBase58(privateKeyBytesLoaded);
  if (privateKey === privateKeyLoaded) {
    info(`${outPathname} created successfully!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
