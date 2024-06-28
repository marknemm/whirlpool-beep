import { anchor } from '@/util/anchor';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';

/**
 * Singleton `Universal Metaplex Interface` (`UMI`) client required by `@metaplex-foundation` module.
 * `Metaplex Token Metadata` is a smart contract that attaches additional data to Fungible and Non-Fungible Tokens.
 *
 * `UMI` is a modular framework for building and using JS clients for Solana programs.
 * It provides a set of higher level tools (compared to `web3.js`) for interacting with Solana account data.
 */
const umi = createUmi(anchor.connection).use(mplTokenMetadata());

export default umi;
