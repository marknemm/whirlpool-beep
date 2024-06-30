import { AnchorProvider } from '@coral-xyz/anchor';
import keypair, { writeWalletJson } from '@/util/wallet-keypair';

let _anchor: AnchorProvider;

/**
 * Gets the singleton {@link AnchorProvider}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link AnchorProvider} singleton.
 */
export default function anchor(): AnchorProvider {
  if (!_anchor) {
    writeWalletJson(keypair()); // Anchor depends on private key in WALLET_JSON file
    _anchor = AnchorProvider.env();
  }

  return _anchor;
}
