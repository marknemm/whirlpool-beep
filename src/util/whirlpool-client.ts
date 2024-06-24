import { AnchorProvider } from '@coral-xyz/anchor';
import { ORCA_WHIRLPOOL_PROGRAM_ID, type WhirlpoolClient, WhirlpoolContext, buildWhirlpoolClient } from '@orca-so/whirlpools-sdk';

let client: WhirlpoolClient;

/**
 * Initializes and gets a singleton {@link whirlpoolClient} for interacting with Whirlpool accounts on Solana.
 *
 * `Note`: Must be invoked after writing the wallet JSON file.
 *
 * @return The singleton {@link WhirlpoolClient}.
 */
export function whirlpoolClient(): WhirlpoolClient {
  if (!client) { // Enforce singleton
    const provider = AnchorProvider.env();
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);

    client = buildWhirlpoolClient(ctx);

    console.log('Initialized whirlpool client');
    console.log('RPC Endpoint:', ctx.connection.rpcEndpoint);
    console.log('Wallet Pubkey:', ctx.wallet.publicKey.toBase58());
  }

  return client;
}
