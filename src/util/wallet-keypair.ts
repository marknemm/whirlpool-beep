import { decodeBase58 } from '@/util/encode';
import { Keypair } from '@solana/web3.js';

/**
 * Get the wallet's public/private {@link Keypair}.
 *
 * @returns The wallet's {@link Keypair}.
 * @throws An error if the private key `WALLET_PRIVATE_KEY` env var is not set.
 */
export function getKeypair(): Keypair {
  const privateKeyBytes = decodeBase58(getPrivateKeyEnv());
  return Keypair.fromSecretKey(privateKeyBytes);
}

/**
 * Get and validate the wallet's public/private {@link Keypair}.
 *
 * @returns The wallet's {@link Keypair}.
 * @throws An error if the private key is invalid or does not match the expected public key.
 */
export function getValidateKeypair(): Keypair {
  const keypair = getKeypair();

  if (keypair.publicKey.toBase58() !== getWalletAddressEnv()) {
    throw new Error('Public key does not match expected value');
  }

  return keypair;
}

/**
 * Get the wallet's private key.
 *
 * @returns The wallet's private key as a (base58) string.
 * @throws An error if the private key `WALLET_PRIVATE_KEY` env var is not set.
 */
function getPrivateKeyEnv(): string {
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY env var is not set');
  }

  return process.env.WALLET_PRIVATE_KEY.trim();
}

/**
 * Get the wallet's public key. This is also the wallet's address.
 *
 * @returns The wallet's public key as a (base58) string.
 * @throws An error if the public key `WALLET_ADDRESS` env var is not set.
 */
function getWalletAddressEnv(): string {
  if (!process.env.WALLET_ADDRESS) {
    throw new Error('WALLET_ADDRESS env var is not set');
  }

  return process.env.WALLET_ADDRESS.trim();
}
