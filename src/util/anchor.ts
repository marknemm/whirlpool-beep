import { decodeBase58 } from '@/util/encode';
import env from '@/util/env';
import rpc from '@/util/rpc';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { info } from '@/util/log';

let _anchor: AnchorProvider;

/**
 * Gets the singleton {@link AnchorProvider}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link AnchorProvider} singleton.
 * @throws An {@link Error} if the {@link Wallet} private key is invalid or does not match the expected public key.
 */
export default function anchor(): AnchorProvider {
  if (!_anchor) {
    // Generate a keypair from the private key env variable
    const privateKeyBytes = decodeBase58(env.WALLET_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKeyBytes); // Performs implicit mathematical validation

    // Double check that the keypair public key matches the expected wallet address
    if (keypair.publicKey.toBase58() !== env.WALLET_ADDRESS) {
      throw new Error('Public key does not match expected value');
    }

    // Create a wallet and anchor provider
    const wallet = new Wallet(keypair);
    _anchor = new AnchorProvider(rpc(), wallet, AnchorProvider.defaultOptions());

    info('-- Initialized Anchor --');
    info('Wallet Address:', wallet.publicKey.toBase58());
  }

  return _anchor;
}
