import type { TokenMeta } from '@/interfaces/token';
import type { BN } from '@coral-xyz/anchor';
import type { Whirlpool } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

/**
 * A tuple containing the tick index range of a {@link Whirlpool} position.
 *
 * The tick index range will be within `[-443636, 443636]`, which maps to a price range of `[2^-64, 2^64]`.
 *
 * @see https://orca-so.gitbook.io/orca-developer-portal/whirlpools/architecture-overview/price-and-ticks
 */
export type PositionTickRange = [number, number];

/**
 * Arguments to derive the `PDA` (program derived address) for a {@link Whirlpool}.
 *
 * A {@link Whirlpool} is hashed by the config, token pair mints, and tick spacing.
 */
export interface WhirlpoolArgs {

  /**
   * The tick spacing defined for the {@link Whirlpool}.
   */
  tickSpacing: number;

  /**
   * The {@link Whirlpool}'s token A {@link TokenMeta} containing a {@link PublicKey}.
   */
  tokenAMeta: TokenMeta;

  /**
   * The {@link Whirlpool}'s token B {@link TokenMeta} containing a {@link PublicKey}.
   */
  tokenBMeta: TokenMeta;

  /**
   * The `WhirlpoolConfig` account {@link PublicKey}.
   *
   * Defaults to the {@link PublicKey} of the config account owned by ORCA foundation.
   *
   * @default WHIRLPOOL_CONFIG_PUBLIC_KEY
   */
  whirlpoolConfigKey?: PublicKey;

}

/**
 * The {@link price} of a {@link Whirlpool}; specifically price of {@link tokenA} in terms of {@link tokenB}.
 */
export interface WhirlpoolPriceData {

  /**
   * The price of {@link tokenA} in terms of {@link tokenB}.
   */
  price: Decimal;

  /**
   * The square root of the price of {@link tokenA} in terms of {@link tokenB}.
   */
  sqrtPrice: BN;

  /**
   * The {@link Whirlpool} that is used to calculate the price.
   */
  whirlpool: Whirlpool;

}
