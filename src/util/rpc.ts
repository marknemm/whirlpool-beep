import { Connection } from '@solana/web3.js';
import env from '@/util/env';

let _rpc: Connection;

/**
 * Gets the singleton `RPC` {@link Connection}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link Connection} singleton.
 */
export default function rpc(): Connection {
  if (!_rpc) {
    _rpc = new Connection(env.ANCHOR_PROVIDER_URL);
  }

  return _rpc;
}
