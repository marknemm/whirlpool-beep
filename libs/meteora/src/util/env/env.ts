import { env as solanaEnv } from '@npc/solana';
import { cleanEnv, num, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables for Meteora.
 */
export const env = {
  ...solanaEnv,
  ...cleanEnv(process.env, {

    /**
     * The default liquidity to use for an operation that involves increasing liquidity in a pool position.
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
     * The URL for the Meteora DLMM API.
     */
    METEORA_DLMM_API: url(),

    /**
     * The URL for Meteora DLMM pools lookup.
     */
    METEORA_DLMM_POOLS_API: str(),

    /**
     * The default slippage tolerance to use when swapping tokens. A percentage [0, 100].
     *
     * @default 1%
     */
    SLIPPAGE_DEFAULT: num({ default: 1 }),

  })
};

export default env;
