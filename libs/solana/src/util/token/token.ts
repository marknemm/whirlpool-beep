import { fetchDigitalAsset, type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import type { Null } from '@npc/core';
import { debug, expBackoff, usdToTokenAmount, warn } from '@npc/core';
import { STABLECOIN_SYMBOL_REGEX } from '@npc/solana/constants/regex';
import SolanaTokenDAO from '@npc/solana/data/solana-token/solana-token.dao';
import { isPubKeyStr, toPubKeyStr } from '@npc/solana/util/address/address';
import env from '@npc/solana/util/env/env';
import umi from '@npc/solana/util/umi/umi';
import { PublicKey } from '@solana/web3.js';
import axios, { type AxiosError } from 'axios';
import BN from 'bn.js';
import Decimal from 'decimal.js';
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
 * @see https://github.com/solflare-wallet/utl-api?tab=readme-ov-file_search-by-content API for querying tokens.
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

  debug('Fetching token using query:', query);

  if (!isPubKeyStr(query)) {
    const tokenMeta = await expBackoff(async () => {
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
      return response.data.content.find((token) => token.symbol === query)
          ?? response.data.content.find((token) => JSON.stringify(token).includes(query as string));
    }, {
      retryFilter: (result, err) => (err as AxiosError)?.response?.status === 429,
    });
    query = tokenMeta?.address ?? '';
  }

  // Fetch token DigitalAsset metadata using PDA and UMI.
  const tokenAsset = toPubKeyStr(query)
    ? await fetchDigitalAsset(umi(), publicKey(query))
    : null;

  if (tokenAsset) {
    _tokenCache.set(query, tokenAsset);
    _tokenCache.set(tokenAsset.publicKey, tokenAsset);

    debug('Fetched token:', formatToken(tokenAsset));
    await SolanaTokenDAO.insert(tokenAsset, { catchErrors: true });
  } else {
    warn('Failed to fetch token using query:', query);
  }

  return tokenAsset;
}

/**
 * Converts a given amount of `USD` to pool token amounts.
 *
 * @param tokenPair The token pair containing the tokens that the {@link usd} amount may be converted to.
 * @param usd The amount of `USD` to convert.
 * @param poolPrice The price of pool token A in terms of pool token B (e.g. SOL in terms of USDC).
 * @returns A {@link Promise} that resolves to the token amount and the {@link LiquidityUnit} of the token.
 */
export async function getTokenAmountsForPool(
  tokenPair: [DigitalAsset, DigitalAsset],
  usd: BN | Decimal.Value,
  poolPrice: Decimal.Value
): Promise<[Decimal, Decimal]> {
  const [tokenA, tokenB] = tokenPair;

  debug(`Converting USD (${usd.toString()}) to token amounts:`, tokenPair.map((token) => token.metadata.symbol));

  let tokenAmountA: Decimal | undefined,
      tokenAmountB: Decimal | undefined;

  // If either token is a stablecoin, prioritize that token
  if (STABLECOIN_SYMBOL_REGEX.test(tokenA.metadata.symbol)) {
    tokenAmountA = usdToTokenAmount(usd, 1);
  } else if (STABLECOIN_SYMBOL_REGEX.test(tokenB.metadata.symbol)) {
    tokenAmountB = usdToTokenAmount(usd, 1);
  }

  // If no USD stablecoin, query the USD price of both tokens via API
  if (!tokenAmountA || !tokenAmountB) {
    try {
      const usdTokenA = await getTokenPrice(tokenA);
      if (usdTokenA) {
        tokenAmountA = usdToTokenAmount(usd, usdTokenA);
      }
    } catch (err) { /* Ignore error and try token B */ }

    if (!tokenAmountA) {
      const usdTokenB = await getTokenPrice(tokenB);
      if (usdTokenB) {
        tokenAmountB = usdToTokenAmount(usd, usdTokenB);
      }
    }
  }

  // If both token amounts are still undefined, throw an error
  if (!tokenAmountA && !tokenAmountB) {
    throw new Error(`Failed to convert USD to token amounts: ${tokenPair.map(formatToken)}`);
  }

  // Get amount of missing token based on pool price
  if (tokenAmountA) {
    tokenAmountB = tokenAmountA.div(poolPrice);
  } else {
    tokenAmountA = tokenAmountB!.mul(poolPrice);
  }

  return [tokenAmountA!, tokenAmountB!];
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
    // Development environment cannot query DeFi value
    : _getDevTokenPrice(token);

  // Add to cache and return.
  if (price) {
    _tokenPriceCache.set(tokenAddress, price);
    _tokenPriceCache.set(tokenSymbol, price);
  }
  return price;
}

function _getDevTokenPrice(token: DigitalAsset): number {
  switch (token.metadata.symbol) {
    case 'SOL':     return 10;
    case 'devSAMO': return .01;
    case 'devTMAC': return .1;
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
    : toPubKeyStr(query as TokenQuery);
}

export type * from './token.interfaces';
