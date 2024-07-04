import env from '@/util/env';
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
