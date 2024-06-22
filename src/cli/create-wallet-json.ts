import { decodeBase58, encodeBase58 } from '@/util/encode';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const walletJsonOut = (process.argv.length > 2) // First arg is node, second arg is script name.
  ?  process.argv[2]
  : 'wallet.json';

const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('privateKey(base58):', (secretBase58Str) => {
  readline.close();
  const secretBytes = decodeBase58(secretBase58Str.trim());

  // write file
  writeFileSync(walletJsonOut, `[${secretBytes.toString()}]`);

  // verify file
  const secretBytesLoaded = readFileSync(walletJsonOut, { encoding: 'utf-8' });
  const secretBase58StrLoaded = encodeBase58(secretBytesLoaded);
  if ( secretBase58Str === secretBase58StrLoaded ) {
    console.log(`${walletJsonOut} created successfully!`);
  }
});
