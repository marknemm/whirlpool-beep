import { info } from '@/util/log/log';
import rpc from '@/util/rpc/rpc';
import wallet from '@/util/wallet/wallet';
import { AnchorProvider } from '@coral-xyz/anchor';

let _anchor: AnchorProvider;

/**
 * Gets the singleton {@link AnchorProvider}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link AnchorProvider} singleton.
 */
export default function anchor() {
  if (!_anchor) {
    _anchor = new AnchorProvider(rpc(), wallet(), AnchorProvider.defaultOptions());

    info('-- Initialized Anchor Provider --');
  }

  return _anchor;
}
