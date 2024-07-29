import type { TokenQuery } from '@/util/token/token.interfaces';
import type { Address } from '@orca-so/common-sdk';
import type { Whirlpool, WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';

/**
 * The options for getting a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @augments WhirlpoolAccountFetchOptions
 * @augments GetWhirlpoolKeyOpts
 */
export interface GetWhirlpoolOpts extends WhirlpoolAccountFetchOptions, GetWhirlpoolKeyOpts {

  /**
   * The {@link Whirlpool} {@link Address}.
   *
   * If provided, will ignore the {@link GetWhirlpoolKeyOpts} and fetch the {@link Whirlpool} directly.
   */
  whirlpoolAddress?: Address;

}

/**
 * The options for getting a {@link Whirlpool} address via a Program Derived Address (PDA).
 */
export interface GetWhirlpoolKeyOpts {

  /**
   * The token A {@link Address} or {@link TokenQuery}.
   */
  tokenA: TokenQuery;

  /**
   * The token B {@link Address} or {@link TokenQuery}.
   */
  tokenB: TokenQuery;

  /**
   * The tick spacing defined for the {@link Whirlpool}.
   */
  tickSpacing: number;

}
