import { decodeBase58, encodeBase58 } from '@/util/encode';
import { info } from '@/util/log';
import { path as appRootPath } from 'app-root-path';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import yargs from 'yargs';

const { out, privateKey } = yargs(process.argv.slice(2))
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
      describe: 'The private key to write to the output file.',
      type: 'string',
    }
  }).parseSync();

function main() {
  if (privateKey) {
    writeWalletJSON(privateKey);
  } else {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('privateKey(base58):', (pkB58Str) => {
      readline.close();
      writeWalletJSON(pkB58Str);
    });
  }
}

function writeWalletJSON(pkB58Str: string) {
  const pkRawBytes = decodeBase58(pkB58Str.trim());

  // write file
  const outPathname = `${appRootPath}/${out}`;
  writeFileSync(outPathname, `[${pkRawBytes.toString()}]`);

  // verify file
  const pkRawBytesLoaded = readFileSync(outPathname, { encoding: 'utf-8' });
  const pkB58StrLoaded = encodeBase58(pkRawBytesLoaded);
  if (privateKey === pkB58StrLoaded) {
    info(`${outPathname} created successfully!`);
  }
}

main();
