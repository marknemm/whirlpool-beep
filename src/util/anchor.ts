import { AnchorProvider } from '@coral-xyz/anchor';
import { type Connection } from '@solana/web3.js';

/**
 * Singleton {@link AnchorProvider} for interacting with Solana Smart Contracts via IDL.
 */
export const anchor = AnchorProvider.env();

/**
 * Singleton RPC {@link Connection} for interacting with Solana.
 */
export const rpc = anchor.connection;
