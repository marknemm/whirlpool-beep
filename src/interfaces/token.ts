import type { BN } from '@coral-xyz/anchor';
import type { TokenInfo, Whirlpool } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Full info for a token.
 */
export type Token = Omit<TokenMeta, 'address'> & TokenInfo;

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
