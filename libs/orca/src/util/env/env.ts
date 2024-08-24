import { env as solanaEnv } from '@npc/solana';
import { bool, cleanEnv, num, str } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables for Orca.
 */
export const env = {
  ...solanaEnv,
  ...cleanEnv(process.env, {

    /**
     * Whether to automatically migrate the database schema on startup.
     *
     * @default false
     */
    DB_MIGRATE: bool({ default: false }),

    /**
     * The default liquidity to use for an operation that involves increasing liquidity in a whirlpool position.
     *
     * @default 0
     */
    INCREASE_LIQUIDITY: num({ default: 0 }),

    /**
     * The unit to use for the {@link env.INCREASE_LIQUIDITY} value.
     *
     * @default 'usd'
     */
    INCREASE_LIQUIDITY_UNIT: str({
      choices: ['liquidity', 'tokenA', 'tokenB', 'usd'],
      default: 'usd'
    }),

    /**
     * The default slippage tolerance to use when swapping tokens. A percentage [0, 100].
     *
     * @default 1%
     */
    SLIPPAGE_DEFAULT: num({ default: 1 }),

    /**
     * The Orca Whirlpool config address.
     */
    WHIRLPOOL_CONFIG_ADDRESS: str(),

    /**
     * The Orca Whirlpool config extension address.
     */
    WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: str(),

  })
};

export default env;
