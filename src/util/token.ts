import type { TokenMeta, TokenQuery, TokenQueryResponse } from '@/interfaces/token';
import env from '@/util/env';
import { debug } from '@/util/log';
import umi from '@/util/umi';
import { fetchDigitalAsset, type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import { AddressUtil, PublicKeyUtils } from '@orca-so/common-sdk';
import axios from 'axios';

/**
 * Cache for previously queried token {@link DigitalAsset}s.
 *
 * Indexed by both token address and symbol.
 */
const _cache = new Map<string, DigitalAsset>();

/**
 * Clears the {@link TokenMeta} cache.
 */
export function clearTokenCache() {
  _cache.clear();
}

/**
 * Fetches an NFT {@link DigitalAsset} by a given {@link query}.
 *
 * @param query The {@link TokenQuery} for the NFT to fetch.
 * @returns A {@link Promise} that resolves to the NFT {@link DigitalAsset};
 * `null` if the NFT is not found or a token is found that is fungible.
 */
export async function getNFT(query: TokenQuery): Promise<DigitalAsset | null> {
  const token = await getToken(query);
  return (token?.mint.supply === 1n)
    ? token
    : null;
}

/**
 * Fetches a pair of tokens {@link TokenMeta} by given queries.
 *
 * @param queryA The {@link TokenQuery} for token A.
 * @param queryB The {@link TokenQuery} for token B.
 * @returns A {@link Promise} that resolves to an array filled with the 2 {@link TokenMeta} pair entries.
 * @throws An error if the GET request fails or either token could not be retrieved.
 */
export async function getTokenPair(
  queryA: TokenQuery,
  queryB: TokenQuery
): Promise<[DigitalAsset, DigitalAsset]> {
  const tokenA = await getToken(queryA);
  const tokenB = await getToken(queryB);

  if (!tokenA || !tokenB) {
    throw new Error(`Failed to fetch token for query: ${!tokenA ? queryA : queryB}`);
  }

  return [tokenA, tokenB];
}

/**
 * Fetches a {@link TokenMeta} by a given {@link query}.
 *
 * @param query The {@link TokenQuery} for the token to fetch.
 * @returns A {@link Promise} that resolves to the {@link TokenMeta} of the token, or `null` if the token is not found.
 * @throws An error if the GET request fails or returns a non-200 status code.
 * @see https://github.com/solflare-wallet/utl-api?tab=readme-ov-file#search-by-content API for querying tokens.
 */
export async function getToken(query: TokenQuery): Promise<DigitalAsset | null> {
  query = _queryToString(query);

  if (_cache.has(query)) {
    return _cache.get(query)!;
  }

  debug('Fetching token for query:', query);

  if (!PublicKeyUtils.isBase58(query)) {
    // Query token via standard token list API that is used by solana explorer.
    const response = await axios.get<TokenQueryResponse>(env.TOKEN_LIST_API, {
      params: {
        chainId: env.CHAIN_ID,
        limit: 10,
        query,
        start: 0,
      }
    });

    // Throw error if response status is not 200.
    if (response.status !== 200) {
      throw new Error(`Failed to fetch token (${response.status}): ${response.statusText}`);
    }

    // Assume query is an exact match of token symbol, otherwise compare query with all token metadata.
    const tokenMeta = response.data.content.find((token) => token.symbol === query)
                   ?? response.data.content.find((token) => JSON.stringify(token).includes(query as string));
    query = tokenMeta?.address ?? '';
  }

  // Fetch token DigitalAsset metadata using PDA and UMI.
  const tokenAsset = PublicKeyUtils.isBase58(query)
    ? await fetchDigitalAsset(umi(), publicKey(query))
    : null;

  if (tokenAsset) {
    _cache.set(query, tokenAsset);
    _cache.set(tokenAsset.publicKey, tokenAsset);
  }
  debug('Fetched token asset:', tokenAsset);

  return tokenAsset;
}

/**
 * Converts a query to a string.
 *
 * @param query The query to convert.
 * @returns The converted query as a string.
 */
function _queryToString(query: TokenQuery): string {
  return (typeof query === 'string')
    ? query
    : AddressUtil.toString(query);
}
