import type { TokenQuery } from '@npc/solana';
import type { Address } from '@orca-so/common-sdk';
import type { Whirlpool, WhirlpoolAccountFetchOptions } from '@orca-so/whirlpools-sdk';

/**
 * Arguments for getting a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @augments WhirlpoolAccountFetchOptions
 * @augments GetWhirlpoolKeyArgs
 */
export interface GetWhirlpoolArgs extends WhirlpoolAccountFetchOptions, Partial<GetWhirlpoolKeyArgs> {

  /**
   * The {@link Whirlpool} {@link Address}.
   *
   * If provided, will ignore the {@link GetWhirlpoolKeyArgs} and fetch the {@link Whirlpool} directly.
   */
  whirlpoolAddress?: Address;

}

/**
 * Arguments for getting a {@link Whirlpool} address via a Program Derived Address (PDA).
 */
export interface GetWhirlpoolKeyArgs {

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
