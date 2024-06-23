
/**
 * Anchor wallet filename. Will contain JSON byte array of the wallet's private key.
 */
export const ANCHOR_WALLET = process.env.ANCHOR_WALLET || 'wallet.json';

/**
 * Anchor provider URL that refers to an RPC endpoint on the Solana blockchain network.
 */
export const ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
