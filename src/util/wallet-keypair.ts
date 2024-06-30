import { decodeBase58, encodeBase58 } from '@/util/encode';
import env from '@/util/env';
import { Keypair } from '@solana/web3.js';
import { readFileSync, writeFileSync } from 'fs';

let _keypair: Keypair;

/**
 * Validates and gets the wallet's singleton public/private {@link Keypair} defined by the
 * `WALLET_ADDRESS` and `WALLET_PRIVATE_KEY` env vars.
 *
 * @returns The wallet's {@link Keypair}.
 * @throws An {@link Error} if the private key is invalid or does not match the expected public key.
 */
export default function keypair(): Keypair {
  if (!_keypair) {
    const privateKeyBytes = decodeBase58(env.WALLET_PRIVATE_KEY);
    _keypair = Keypair.fromSecretKey(privateKeyBytes); // Performs implicit mathematical validation

    if (_keypair.publicKey.toBase58() !== env.WALLET_ADDRESS) {
      throw new Error('Public key does not match expected value');
    }
  }

  return _keypair;
}

/**
 * Write the wallet's private key byte array to a JSON file.
 *
 * @param keypair The wallet's {@link Keypair}.
 * @throws An {@link Error} if the private key byte array could not be written to the JSON file.
 */
export function writeWalletJson(keypair: Keypair) {
  // Write wallet JSON file
  writeFileSync(env.ANCHOR_WALLET, `[${keypair.secretKey.toString()}]`, { encoding: 'utf-8' });

  // Verify wallet jSON file
  const pkRawBytesLoaded = readFileSync(env.ANCHOR_WALLET, { encoding: 'utf-8' });
  const pkB58StrLoaded = encodeBase58(pkRawBytesLoaded);
  if (env.WALLET_PRIVATE_KEY !== pkB58StrLoaded) {
    throw new Error(`Failed to write private key to ${env.ANCHOR_WALLET}`);
  }
}
