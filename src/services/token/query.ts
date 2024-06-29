import type { TokenMeta, TokenQueryResponse } from '@/interfaces/token';
import env from '@/util/env';
import umi from '@/util/umi';
import { fetchDigitalAsset, type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import { PublicKeyUtils } from '@orca-so/common-sdk';
import axios from 'axios';

/**
 * Fetches a pair of tokens' {@link TokenMeta} by their symbols.
 *
 * @param queryA The query for the first token to fetch. Defaults to {@link env.TOKEN_A}.
 * @param queryB The query for the second token to fetch. Defaults to {@link env.TOKEN_B}.
 * @returns A {@link Promise} that resolves to an array filled with the 2 {@link TokenMeta} pair entries.
 * @throws An error if the GET request fails or either token could not be retrieved.
 * @see https://github.com/solflare-wallet/utl-api?tab=readme-ov-file#search-by-content API for querying tokens.
 */
export async function getTokenMetaPair(
  queryA: string = env.TOKEN_A,
  queryB: string = env.TOKEN_B
): Promise<[TokenMeta, TokenMeta]> {
  const tokenAMeta = await getTokenMeta(queryA);
  const tokenBMeta = await getTokenMeta(queryB);

  if (!tokenAMeta || !tokenBMeta) {
    throw new Error(`Failed to fetch token metadata for query: ${!tokenAMeta ? queryA : queryB}`);
  }

  return [tokenAMeta, tokenBMeta];
}

/**
 * Fetches a token's metadata by its symbol.
 *
 * @param query The query for the token to fetch.
 * @returns A {@link Promise} that resolves to the {@link TokenMeta} of the token, or `null` if the token is not found.
 * @throws An error if the GET request fails or returns a non-200 status code.
 * @see https://github.com/solflare-wallet/utl-api?tab=readme-ov-file#search-by-content API for querying tokens.
 */
export async function getTokenMeta(query: string): Promise<TokenMeta | null> {
  const params = {
    chainId: env.CHAIN_ID,
    limit: 10,
    query,
    start: 0,
  };

  // Query token via standard token list API that is used by solana explorer.
  const response = await axios.get<TokenQueryResponse>(env.TOKEN_LIST_API, { params });

  if (response.status !== 200) {
    throw new Error('Failed to fetch token');
  }

  // Assume query is an exact match of token symbol, otherwise compare query with all token metadata.
  let tokenMeta = response.data.content.find((token) => token.symbol === query)
               ?? response.data.content.find((token) => JSON.stringify(token).includes(query))
               ?? null;

  // Some devnet tokens are not in the standard token list API, so we need to fetch them manually.
  // Can only fetch manually if given a base58 public key of the token mint.
  if (!tokenMeta && PublicKeyUtils.isBase58(query)) {
    // Higher level function than web3.js RPC that fetches token mint and metadata account data using PDA.
    const digitalAsset = await fetchDigitalAsset(umi, publicKey(query));
    tokenMeta = digitalAssetToTokenMeta(digitalAsset);
  }

  return tokenMeta;
}

/**
 * Converts a {@link DigitalAsset} to a {@link TokenMeta}.
 *
 * @param digitalAsset The {@link DigitalAsset} to convert.
 * @returns The generated {@link TokenMeta}, or `null` if the {@link DigitalAsset} is `null`.
 */
function digitalAssetToTokenMeta(digitalAsset: DigitalAsset): TokenMeta | null {
  if (!digitalAsset) return null;

  return {
    address: digitalAsset.mint.publicKey,
    decimals: digitalAsset.mint.decimals,
    name: digitalAsset.metadata.name,
    symbol: digitalAsset.metadata.symbol,
    tags: [],
    uri: digitalAsset.metadata.uri,
  };
}
