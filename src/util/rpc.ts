import { Connection } from '@solana/web3.js';

/**
 * The singleton RPC endpoint {@link Connection} to the Solana cluster.
 */
const rpc = new Connection(
  process.env.RPC_ENDPOINT_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

export default rpc;
