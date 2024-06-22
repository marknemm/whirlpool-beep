import { exec } from 'child_process';
import 'dotenv/config';
import { decodeBase58 } from './util/encode';
import { writeFileSync } from 'fs';

function main() {
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY is not set');
  }
  if (!process.env.WALLET_ADDRESS) {
    throw new Error('WALLET_ADDRESS is not set');
  }
  const walletJsonFile = process.env.WALLET_JSON_FILE || 'wallet.json';

  const privateKeyBytes = decodeBase58(process.env.WALLET_PRIVATE_KEY);
  writeFileSync(walletJsonFile, `[${privateKeyBytes.toString()}]`);

  exec(`solana address -k ${walletJsonFile}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`);
      return;
    }

    if (stdout) {
      console.log(stdout);
      console.log(`Wallet JSON file created successfully: ${stdout.trim() === process.env.WALLET_ADDRESS?.trim()}`);
    }

    if (stderr) {
      console.error(stderr);
    }
  });
}

main();
