import { decodeBase58, encodeBase58 } from '@/util/encode';
import { path as appRootPath } from 'app-root-path';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const outFilename = (process.argv.length > 2) // First arg is node, second arg is script name.
  ?  `${appRootPath}/${process.argv[2]}`
  : `${appRootPath}/wallet-pk.json`;

const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('privateKey(base58):', (pkB58Str) => {
  readline.close();
  const pkRawBytes = decodeBase58(pkB58Str.trim());

  // write file
  writeFileSync(outFilename, `[${pkRawBytes.toString()}]`);

  // verify file
  const pkRawBytesLoaded = readFileSync(outFilename, { encoding: 'utf-8' });
  const pkB58StrLoaded = encodeBase58(pkRawBytesLoaded);
  if ( pkB58Str === pkB58StrLoaded ) {
    console.log(`${outFilename} created successfully!`);
  }
});
