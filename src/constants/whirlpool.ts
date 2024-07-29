import env from '@/util/env/env';
import { PublicKey } from '@solana/web3.js';

/**
 * WhirlpoolsConfigExtension account public key.
 *
 * @see https://orca-so.gitbook.io/orca-developer-portal/whirlpools/interacting-with-the-protocol/orca-whirlpools-parameters#whirlpoolconfig-address
 */
export const WHIRLPOOL_CONFIG_EXTENSION_PUBLIC_KEY = new PublicKey(
  env.WHIRLPOOL_CONFIG_EXTENSION_ADDRESS
);

/**
 * WhirlpoolsConfig account public key.
 *
 * @see https://orca-so.gitbook.io/orca-developer-portal/whirlpools/interacting-with-the-protocol/orca-whirlpools-parameters#whirlpoolconfigextension-address
 */
export const WHIRLPOOL_CONFIG_PUBLIC_KEY = new PublicKey(
  env.WHIRLPOOL_CONFIG_ADDRESS
);

/**
 * Symbol for `Whirlpool` position bundle NFTs.
 */
export const WHIRLPOOL_POSITION_BUNDLE_SYMBOL = 'OPB';

/**
 * Symbol for `Whirlpool` position NFTs.
 */
export const WHIRLPOOL_POSITION_SYMBOL = 'OWP';

/**
 * Dev SOL / USDC whirlpool address.
 */
export const DEV_SOL_USDC_ADDRESS = '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt';

/**
 * Dev USDC / USDT whirlpool address.
 */
export const DEV_USDC_USDT_ADDRESS = '63cMwvN8eoaD39os9bKP8brmA7Xtov9VxahnPufWCSdg';

/**
 * Dev SAMO / USDC whirlpool address.
 */
export const DEV_SAMO_USDC_ADDRESS = 'EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4';

/**
 * Dev TMAC / USDC whirlpool address.
 */
export const DEV_TMAC_USDC_ADDRESS = 'H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y	';
