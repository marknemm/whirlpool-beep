import type { Address } from '@coral-xyz/anchor';

/**
 * Token metadata.
 */
export interface TokenMeta {

  /**
   * The address of the token.
   */
  address: string;

  /**
   * The number of decimals for the token amount.
   */
  decimals: number;

  /**
   * The logo URI of the token.
   */
  logoURI?: string;

  /**
   * The name of the token.
   */
  name: string;

  /**
   * The symbol of the token.
   */
  symbol: string;

  /**
   * The tags for the token.
   */
  tags?: string[];

  /**
   * The URI for the token.
   */
  uri?: string;

}

/**
 * The response of a token query.
 */
export interface TokenQueryResponse {

  /**
   * The content of the response.
   */
  content: TokenMeta[];

}

/**
 * A token query.
 *
 * Can be a token `symbol` or mint {@link Address}.
 */
export type TokenQuery = string | Address;

/**
 * The response of a token price query.
 */
export interface TokenPriceResponse {

  [token: string]: {

    /**
     * The price of the token in USD.
     */
    usd: number;

  }

}
