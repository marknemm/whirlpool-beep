import { AnchorProvider } from '@coral-xyz/anchor';
import { info } from '@npc/core';
import rpc from '@npc/solana/util/rpc/rpc';
import wallet from '@npc/solana/util/wallet/wallet';

let _anchor: AnchorProvider;

/**
 * Gets the singleton {@link AnchorProvider}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link AnchorProvider} singleton.
 */
export function anchor() {
  if (!_anchor) {
    _anchor = new AnchorProvider(rpc(), wallet(), AnchorProvider.defaultOptions());

    info('-- Initialized Anchor Provider --');
  }

  return _anchor;
}

export default anchor;
