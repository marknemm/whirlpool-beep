import env from '@/util/env';
import { debug, info } from '@/util/log';
import { Connection } from '@solana/web3.js';

let _rpc: Connection;

/**
 * Gets the singleton `RPC` {@link Connection}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link Connection} singleton.
 */
export default function rpc(): Connection {
  if (!_rpc) {
    _rpc = new Connection(env.ANCHOR_PROVIDER_URL);

    info('-- Initialized RPC Connection --');
    info('RPC Endpoint:', _rpc.rpcEndpoint);
  }

  return _rpc;
}

/**
 * Verifies a blockchain transaction by waiting for it to be confirmed.
 *
 * @param signature The signature of the transaction to verify.
 * @returns A {@link Promise} that resolves when the transaction is confirmed.
 * @throws An {@link Error} if the transaction cannot be confirmed.
 */
export async function verifyTransaction(signature: string): Promise<void> {
  debug('Verifying Tx with signature:', signature);

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  const confirmResponse = await rpc().confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

  if (confirmResponse.value.err) {
    throw new Error(confirmResponse.value.err.toString());
  }
}
