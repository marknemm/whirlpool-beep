import type { TokenMeta } from '@/interfaces/token';
import type { Whirlpool, WhirlpoolClient } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';

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
   * The {@link Whirlpool}'s token A {@link PublicKey}.
   */
  tokenAMeta: TokenMeta;

  /**
   * The {@link Whirlpool}'s token B {@link PublicKey}.
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
 * Helper class to help interact with Whirlpool Accounts with a simpler interface.
 *
 * Also contains custom extension methods.
 *
 * @extends WhirlpoolClient The native Orca SO {@link WhirlpoolClient}.
 */
export interface WhirlpoolClientExt extends WhirlpoolClient {

  /**
   * Custom ext that gets a {@link Whirlpool} via a Program Derived Address (PDA).
   *
   * @param args The {@link WhirlpoolArgs arguments} to derive the PDA for the Whirlpool.
   * @returns The {@link Whirlpool}.
   */
  getPoolViaPDA(args: WhirlpoolArgs): Promise<Whirlpool>;

}

export interface WhirlpoolPositionRange {

}
