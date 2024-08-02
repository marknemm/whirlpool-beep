import { STABLECOIN_SYMBOL_REGEX } from '@/constants/regex';
import { DEV_SAMO_USDC_ADDRESS, DEV_SOL_USDC_ADDRESS, DEV_TMAC_USDC_ADDRESS } from '@/constants/whirlpool';
import TokenDAO from '@/data/token/token.dao';
import type { Null } from '@/interfaces/nullable.interfaces';
import { expBackoff } from '@/util/async/async';
import env from '@/util/env/env';
import { info, warn } from '@/util/log/log';
import umi from '@/util/umi/umi';
import whirlpoolClient, { getWhirlpoolPrice } from '@/util/whirlpool/whirlpool';
import { fetchDigitalAsset, type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import { AddressUtil, PublicKeyUtils } from '@orca-so/common-sdk';
import { PublicKey } from '@solana/web3.js';
import axios, { AxiosError } from 'axios';
import type { TokenPriceResponse, TokenQuery, TokenQueryResponse } from './token.interfaces';

/**
 * Cache for previously queried token {@link DigitalAsset}s.
 *
 * Indexed by both token address and symbol.
 */
const _tokenCache = new Map<string, DigitalAsset>();

/**
 * Cache for previously queried token prices.
 *
 * Indexed by both token address and symbol.
 */
const _tokenPriceCache = new Map<string, number>();

/**
 * Clears the token cache.
 */
export function clearTokenCache() {
  _tokenCache.clear();
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
 * Fetches a pair of tokens by given queries.
 *
 * @param queryA The {@link TokenQuery} for token A.
 * @param queryB The {@link TokenQuery} for token B.
 * @returns A {@link Promise} that resolves to an array filled with the {@link DigitalAsset} token pair entries.
 * @throws An error if the GET request fails or either token could not be retrieved.
 */
export async function getTokenPair(
  queryA: TokenQuery,
  queryB: TokenQuery
): Promise<[DigitalAsset, DigitalAsset]> {
  const tokenA = await getToken(queryA);
  const tokenB = await getToken(queryB);

  if (!tokenA || !tokenB) {
    throw new Error(`Failed to fetch token using query: ${!tokenA ? queryA : queryB}`);
  }

  return [tokenA, tokenB];
}

/**
 * Fetches a token by a given {@link query}.
 *
 * @param query The {@link TokenQuery} for the token to fetch.
 * @param ignoreCache Whether to ignore the cache and fetch the token. Defaults to `false`.
 * @returns A {@link Promise} that resolves to the {@link DigitalAsset} of the token, or `null` if the token is not found.
 * @throws An error if the GET request fails or returns a non-200 status code.
 * @see https://github.com/solflare-wallet/utl-api?tab=readme-ov-file#search-by-content API for querying tokens.
 */
export async function getToken(
  query: TokenQuery | Null,
  ignoreCache = false
): Promise<DigitalAsset | null> {
  query = _queryToString(query);
  if (!query) return null;

  // Attempt to pull from cache if allowed and available
  if (!ignoreCache && _tokenCache.has(query)) {
    return _tokenCache.get(query)!;
  }

  info('Fetching token using query:', query);

  if (!PublicKeyUtils.isBase58(query) || query.length < 32) {
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
  const tokenAsset = PublicKeyUtils.isBase58(query) && query.length >= 32
    ? await fetchDigitalAsset(umi(), publicKey(query))
    : null;

  if (tokenAsset) {
    _tokenCache.set(query, tokenAsset);
    _tokenCache.set(tokenAsset.publicKey, tokenAsset);

    info('Fetched token:', formatToken(tokenAsset));
    await TokenDAO.insert(tokenAsset, { catchErrors: true });
  } else {
    warn('Failed to fetch token using query:', query);
  }

  return tokenAsset;
}

/**
 * Gets the price of a token in USD.
 *
 * @param token The token {@link DigitalAsset} or {@link TokenQuery} to get the price of.
 * @param ignoreCache Whether to ignore the cache and fetch the token price. Defaults to `false`.
 * @returns A {@link Promise} that resolves to the price of the token in USD.
 * If the token price cannot be fetched, `undefined` is returned.
 * @throws An {@link Error} if the GET request fails or returns a non-200 status code.
 * @see https://docs.coingecko.com
 */
export async function getTokenPrice(
  token: DigitalAsset | TokenQuery | Null,
  ignoreCache = false
): Promise<number | undefined> {
  if (!token) return undefined;

  // Attempt to pull from cache if allowed and available
  const tokenAddress = _queryToString(token);
  if (!ignoreCache && _tokenPriceCache.has(tokenAddress)) {
    return _tokenPriceCache.get(tokenAddress);
  }

  // Get token metadata if not already a DigitalAsset
  if (typeof token === 'string' || token instanceof PublicKey) {
    token = (await getToken(token))!;
    if (!token) throw new Error(`Failed to fetch token using query: ${token}`);
  }
  const tokenSymbol = token.metadata.symbol;

  // Short circuit for common stablecoins
  if (STABLECOIN_SYMBOL_REGEX.test(tokenSymbol)) {
    return 1;
  }

  const price = (env.NODE_ENV === 'production')
    // Production environment query aggregate DeFi value
    ? await expBackoff(async () => {
      const response = await axios.get<TokenPriceResponse>(env.TOKEN_PRICE_API, {
        params: {
          contract_addresses: token.mint.publicKey, // eslint-disable-line camelcase
          vs_currencies: 'usd',                     // eslint-disable-line camelcase
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch token price ( ${response.status} ): ${response.statusText}`);
      }

      return response.data[token.mint.publicKey]?.usd;
    }, {
      retryFilter: (result, err) => (err as AxiosError)?.response?.status === 429,
    })
    // Development environment query direct liquidity pool value based on stable coin
    : await _getDevTokenPrice(token);

  // Add to cache and return.
  if (price) {
    _tokenPriceCache.set(tokenAddress, price);
    _tokenPriceCache.set(tokenSymbol, price);
  }
  return price;
}

async function _getDevTokenPrice(token: DigitalAsset): Promise<number> {
  switch (token.metadata.symbol) {
    case 'SOL':
      return (await getWhirlpoolPrice(
        await whirlpoolClient().getPool(DEV_SOL_USDC_ADDRESS))
      ).toNumber();
    case 'devSAMO':
      return (await getWhirlpoolPrice(
        await whirlpoolClient().getPool(DEV_SAMO_USDC_ADDRESS))
      ).toNumber();
    case 'devTMAC':
      return (await getWhirlpoolPrice(
        await whirlpoolClient().getPool(DEV_TMAC_USDC_ADDRESS))
      ).toNumber();
  }

  return 1;
}

/**
 * Formats a token {@link DigitalAsset} into a human-readable log ID.
 *
 * @param token The token {@link DigitalAsset} to format.
 * @returns The formatted log ID. If the token is `null`, an empty string is returned.
 */
export function formatToken(token: DigitalAsset | Null): string {
  return token
    ? `${token.metadata.symbol} - ${token.mint.publicKey}`
    : '';
}

/**
 * Converts a query to a string.
 *
 * @param query The query to convert.
 * @returns The converted query as a string.
 */
function _queryToString(query: DigitalAsset | TokenQuery | Null): string {
  if (!query) return '';

  if ((query as DigitalAsset).publicKey) {
    return (query as DigitalAsset).publicKey;
  }

  return (typeof query === 'string')
    ? query
    : AddressUtil.toString(query as TokenQuery);
}

export type * from './token.interfaces';
