import type { Address } from '@coral-xyz/anchor';
import type { TokenQuery } from '@npc/solana';

/**
 * Arguments for getting a Meteora liquidity pool.
 *
 * @augments GetPoolKeyArgs Arguments for getting a Meteora liquidity pool key.
 */
export interface GetPoolArgs extends Partial<GetPoolKeyArgs> {

  /**
   * Whether to ignore the cache and fetch the pool data.
   *
   * @default false
   */
  ignoreCache?: boolean;

  /**
   * The pool {@link Address}.
   *
   * If provided, will ignore the {@link GetPoolKeyArgs} and fetch the pool directly.
   */
  poolAddress?: Address;

}

/**
 * Arguments for getting a Meteora liquidity pool key.
 */
export interface GetPoolKeyArgs {

  /**
   * The base fee for the pool (e.g. 0.03 for 3%).
   */
  baseFee: number;

  /**
   * The bin step for the pool (e.g. 2).
   */
  binStep: number;

  /**
   * Pool token X.
   */
  tokenX: TokenQuery;

  /**
   * Pool token Y.
   */
  tokenY: TokenQuery;

}

export interface ResolvePoolOptions {

  /**
   * Whether to ignore the cache and fetch the pool data.
   *
   * @default false
   */
  ignoreCache?: boolean;

}
