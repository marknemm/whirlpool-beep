import { env as coreEnv } from '@npc/core';
import { cleanEnv, num, str, url } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables for Solana.
 */
export const env = {
  ...coreEnv,
  ...cleanEnv(process.env, {

    /**
     * The chain ID of the Solana cluster.
     *
     * `mainnet` = 101
     *
     * `devnet`= 103
     */
    CHAIN_ID: num(),

    /**
     * The default {@link Commitment} level to use when sending transactions.
     */
    COMMITMENT_DEFAULT: str({
      choices: ['confirmed', 'finalized', 'max', 'processed', 'recent', 'root', 'single', 'singleGossip'],
      default: 'confirmed'
    }),

    /**
     * The margin to add to the compute unit estimate for a transaction. A percentage [0, 100].
     *
     * @default 10%
     */
    COMPUTE_LIMIT_MARGIN: num({ default: 10 }),

    /**
     * The Helius API endpoint.
     */
    HELIUS_API: url(),

    /**
     * The Helius RPC endpoint.
     */
    HELIUS_RPC_ENDPOINT: url(),

    /**
     * The Helius API key.
     *
     * @default ''
     */
    HELIUS_API_KEY: str({ default: '' }),

    /**
     * The minimum total priority fee for a transaction in lamports.
     *
     * @default 10000 lamports (0.00001 SOL)
     */
    PRIORITY_FEE_MIN_LAMPORTS: num({ default: 10000 }),   // 0.00001 SOL

    /**
     * The maximum total priority fee for a transaction in lamports.
     *
     * @default 2000000 lamports (0.002 SOL)
     */
    PRIORITY_FEE_MAX_LAMPORTS: num({ default: 2000000 }), // 0.002 SOL

    /**
     * The default priority to use when generating the compute budget for a transaction.
     *
     * @default 'medium'
     */
    PRIORITY_LEVEL_DEFAULT: str({
      choices: ['min', 'low', 'medium', 'high', 'veryHigh', 'unsafeMax'],
      default: 'medium'
    }),

    /**
     * The RPC endpoint used to access the Solana cluster.
     */
    RPC_ENDPOINT: url(),

    /**
     * The default maximum number of retries an RPC node should attempt when sending a transaction to the leader validator.
     *
     * @default 3
     */
    RPC_MAX_RETRIES: num({ default: 3 }),

    /**
     * The API endpoint for listing token metadata based on a query such as a token symbol or name.
     */
    TOKEN_LIST_API: url(),

    /**
     * The API endpoint for getting the price of a token in USD.
     */
    TOKEN_PRICE_API: url(),

    /**
     * The user's base58 wallet address.
     */
    WALLET_ADDRESS: str(),

    /**
     * The user's base58 wallet private key.
     */
    WALLET_PRIVATE_KEY: str(),

  })
};

export default env;
