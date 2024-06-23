import { decodeBase58 } from '@/util/encode';
import { exec } from 'child_process';

/**
 * Get the wallet's private key.
 *
 * @returns The wallet's private key as a (base58) string.
 * @throws An error if the private key (WALLET_PRIVATE_KEY) env var is not set.
 */
export function getPrivateKey(): string {
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY env var is not set');
  }

  return process.env.WALLET_PRIVATE_KEY.trim();
}

/**
 * Get the wallet's private key as a raw byte array.
 *
 * @returns The wallet's private key as a raw {@link Uint8Array}.
 */
export function getPrivateKeyBytes(): Uint8Array {
  return decodeBase58(getPrivateKey());
}

/**
 * Get the wallet's public key. This is also the wallet's address.
 *
 * @returns The wallet's public key as a (base58) string.
 * @throws An error if the public key (WALLET_ADDRESS) env var is not set.
 */
export function getPublicKey(): string {
  if (!process.env.WALLET_ADDRESS) {
    throw new Error('WALLET_ADDRESS env var is not set');
  }

  return process.env.WALLET_ADDRESS.trim();
}

/**
 * Gets and validates the wallet's private key.
 *
 * @returns A {@link Promise} that resolves to the wallet's private key as a (base58) string.
 * @throws An error if the private key is invalid or does not match the expected public key.
 */
export async function validatePrivateKey(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`solana address -k <(echo "${getPrivateKeyBytes.toString()}")`, (error, stdout, stderr) => {
      // Handle any failures/errors and bail.
      if (error || stderr || !stdout) {
        reject(error ?? new Error(stderr || 'Public key (wallet address) could not be produced from the private key'));
        return;
      }

      const matchPublicKey = stdout.trim();

      try {
        // Check queried public key (wallet address) against the expected value.
        (matchPublicKey === getPublicKey())
          ? resolve(getPrivateKey())
          : reject(new Error(`Public key does not match expected value: ${matchPublicKey} != ${getPublicKey()}`));
      } catch (error) {
        reject(error); // Catch any errors related to missing env vars.
      }
    });
  });
}
