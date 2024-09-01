import type { TokenQuery } from '@npc/solana';
import type { Address } from '@orca-so/common-sdk';

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
   * Pool token A.
   */
  tokenA: TokenQuery;

  /**
   * Pool token B.
   */
  tokenB: TokenQuery;

}

/**
 * Raw API response data for a Meteora liquidity pool.
 */
export interface RawPoolData {

  /**
   * The base 58 address of the pool.
   */
  address: string;

  /**
   * The APR for the pool.
   */
  apr: number;

  /**
   * The APY for the pool.
   */
  apy: number;

  /**
   * The base fee percentage for the pool.
   */
  base_fee_percentage: string;

  /**
   * The bin step for the pool.
   */
  bin_step: number;

  /**
   * The cumulative fee volume for the pool.
   */
  cumulative_fee_volume: string;

  /**
   * The cumulative trade volume for the pool.
   */
  cumulative_trade_volume: string;

  /**
   * The current price for the pool.
   */
  current_price: number;

  /**
   * The pool farm APR.
   */
  farm_apr: number;

  /**
   * The pool farm APY.
   */
  farm_apy: number;

  /**
   * The 24 hour fee volume for the pool.
   */
  fees_24h: number;

  /**
   * Whether the pool is hidden.
   */
  hide: boolean;

  /**
   * The liquidity volume for the pool.
   */
  liquidity: string;

  /**
   * The max fee percentage for the pool.
   */
  max_fee_percentage: string;

  /**
   * The mint X address for the pool.
   */
  mint_x: string;

  /**
   * The mint Y address for the pool.
   */
  mint_y: string;

  /**
   * The name of the pool.
   */
  name: string;

  /**
   * The pool protocol fee percentage.
   */
  protocol_fee_percentage: string;

  /**
   * The reserve X address for the pool.
   */
  reserve_x: string;

  /**
   * The reserve X amount for the pool.
   */
  reserve_x_amount: number;

  /**
   * The reserve Y address for the pool.
   */
  reserve_y: string;

  /**
   * The reserve Y amount for the pool.
   */
  reserve_y_amount: number;

  /**
   * The reward mint X address for the pool.
   */
  reward_mint_x: string;

  /**
   * The reward mint Y address for the pool.
   */
  reward_mint_y: string;

  /**
   * The fee volume for the pool today.
   */
  today_fees: number;

  /**
   * The trade volume for the pool today.
   */
  trade_volume_24h: number;

}
