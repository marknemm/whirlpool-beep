import { decodeBase58, encodeBase58 } from '@/util/encode';
import env from '@/util/env';
import { Keypair } from '@solana/web3.js';
import { readFile, writeFile } from 'fs/promises';

/**
 * Get the wallet's public/private {@link Keypair}.
 *
 * @returns The wallet's {@link Keypair}.
 * @throws An error if the private key `WALLET_PRIVATE_KEY` env var is not set or is invalid.
 */
export function getKeypair(): Keypair {
  const privateKeyBytes = decodeBase58(env.WALLET_PRIVATE_KEY);
  return Keypair.fromSecretKey(privateKeyBytes);
}

/**
 * Get and perform extra validation on the wallet's public/private {@link Keypair}.
 *
 * @returns The wallet's {@link Keypair}.
 * @throws An {@link Error} if the private key is invalid or does not match the expected public key.
 */
export function getValidateKeypair(): Keypair {
  const keypair = getKeypair();

  if (keypair.publicKey.toBase58() !== env.WALLET_ADDRESS) {
    throw new Error('Public key does not match expected value');
  }

  return keypair;
}

/**
 * Write the wallet's private key byte array to a JSON file.
 *
 * @param keypair The wallet's {@link Keypair}.
 * @returns A {@link Promise} that resolves when the wallet JSON file has been written.
 * @throws An {@link Error} if the private key byte array could not be written to the JSON file.
 */
export async function writeWalletJson(keypair: Keypair): Promise<void> {
  // write file
  await writeFile(env.ANCHOR_WALLET, `[${keypair.secretKey.toString()}]`, { encoding: 'utf-8' });

  // verify file
  const pkRawBytesLoaded = await readFile(env.ANCHOR_WALLET, { encoding: 'utf-8' });
  const pkB58StrLoaded = encodeBase58(pkRawBytesLoaded);
  if (env.WALLET_PRIVATE_KEY !== pkB58StrLoaded) {
    throw new Error(`Failed to write private key to ${env.ANCHOR_WALLET}`);
  }
}
