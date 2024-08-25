import { debug } from '@npc/core';
import { Connection, type ConnectionConfig } from '@solana/web3.js';
import env from '../env/env';

let _rpc: Connection;

/**
 * Gets the singleton `RPC` {@link Connection}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link Connection} singleton.
 */
export function rpc(): Connection {
  if (!_rpc) {
    const config: ConnectionConfig = {
      commitment: env.COMMITMENT_DEFAULT,
    };
    _rpc = new Connection(env.RPC_ENDPOINT, config);

    debug('-- Initialized RPC Connection --\n', config);
  }

  return _rpc;
}

export default rpc;
