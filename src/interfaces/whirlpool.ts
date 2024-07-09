import { type Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * CLI arguments for getting a {@link Whirlpool}.
 */
export interface GetWhirlpoolCliArgs {

  /**
   * The tick spacing of the {@link Whirlpool}.
   *
   * Ignored if {@link whirlpool} is provided.
   */
  tickSpacing?: number;

  /**
   * The token A mint address or symbol.
   *
   * Ignored if {@link whirlpool} is provided.
   */
  tokenA?: string;

  /**
   * The token B mint address or symbol.
   *
   * Ignored if {@link whirlpool} is provided.
   */
  tokenB?: string;

  /**
   * The {@link Whirlpool} address to create a position for.
   */
  whirlpool?: string;

}