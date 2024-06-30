import rpc from '@/util/rpc';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { type Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';

let _umi: Umi;

/**
 * Gets the singleton {@link Umi} client, and initializes it if it has not already been initialized.
 *
 * The `Universal Metaplex Interface` (`UMI`) client is required by `@metaplex-foundation` module.
 * `Metaplex Token Metadata` is a smart contract that attaches additional data to Fungible and Non-Fungible Tokens.
 *
 * `UMI` is a modular framework for building and using JS clients for Solana programs.
 * It provides a set of higher level tools (compared to `web3.js`) for interacting with Solana account data.
 *
 * @returns The singleton {@link Umi} client.
 */
export default function umi(): Umi {
  if (!_umi) {
    _umi = createUmi(rpc()).use(mplTokenMetadata());
  }

  return _umi;
}
