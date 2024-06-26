import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { WhirlpoolArgs } from '@/interfaces/whirlpool';
import { AnchorProvider } from '@coral-xyz/anchor';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolContext, buildWhirlpoolClient, type Whirlpool, type WhirlpoolClient } from '@orca-so/whirlpools-sdk';

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

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param args The {@link WhirlpoolArgs arguments} to derive the PDA for the Whirlpool.
 * @returns The {@link Whirlpool}.
 */
export function getPoolViaPDA(args: WhirlpoolArgs): Promise<Whirlpool> {
  const whirlpoolPublicKey = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    args.whirlpoolConfigKey ?? WHIRLPOOL_CONFIG_PUBLIC_KEY,
    args.tokenAMeta.mint,
    args.tokenBMeta.mint,
    args.tickSpacing
  ).publicKey;

  console.log('whirlpool key:', whirlpoolPublicKey.toBase58());
  return whirlpoolClient().getPool(whirlpoolPublicKey);
}
