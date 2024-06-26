import type { TokenMeta } from '@/interfaces/token';
import { env } from '@/util/env';
import { PublicKey } from '@solana/web3.js';

/**
 * `SAMO` {@link TokenMeta}.
 */
export const SAMO_TOKEN_META: TokenMeta = {
  mint: new PublicKey(env.SAMO_ADDRESS),
  name: 'Samoyed Coin',
  symbol: 'SAMO',
};

export const SOL_TOKEN_META: TokenMeta = {
  mint: new PublicKey(env.SOL_ADDRESS),
  name: 'Wrapped SOL',
  symbol: 'SOL',
};

/**
 * `USDC` {@link TokenMeta}.
 */
export const USDC_TOKEN_META: TokenMeta = {
  mint: new PublicKey(env.USDC_ADDRESS),
  name: 'USD Coin',
  symbol: 'USDC',
};

/**
 * `USDT` {@link TokenMeta}.
 */
export const USDT_TOKEN_META: TokenMeta = {
  mint: new PublicKey(env.USDT_ADDRESS),
  name: 'USDT',
  symbol: 'USDT',
};
