import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import type { WhirlpoolArgs } from '@/interfaces/whirlpool';
import anchor from '@/util/anchor';
import { debug, info } from '@/util/log';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolClient, WhirlpoolContext, buildWhirlpoolClient, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

export * from '@/interfaces/whirlpool';

let _whirlpoolClient: WhirlpoolClient;

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param args The {@link WhirlpoolArgs arguments} to derive the PDA for the Whirlpool.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getPoolViaPDA(args: WhirlpoolArgs): Promise<Whirlpool> {
  debug('Whirlpool args:', args);

  const whirlpoolPublicKey = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    args.whirlpoolConfigKey ?? WHIRLPOOL_CONFIG_PUBLIC_KEY,
    new PublicKey(args.tokenAMeta.address),
    new PublicKey(args.tokenBMeta.address),
    args.tickSpacing
  ).publicKey;

  info('Retrieving whirlpool with public key:', whirlpoolPublicKey.toBase58());
  return whirlpoolClient().getPool(whirlpoolPublicKey);
}

/**
 * Gets the singleton {@link WhirlpoolClient}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link WhirlpoolClient} singleton.
 */
export default function whirlpoolClient(): WhirlpoolClient {
  if (!_whirlpoolClient) {
    const ctx = WhirlpoolContext.withProvider(anchor(), ORCA_WHIRLPOOL_PROGRAM_ID);

    _whirlpoolClient = buildWhirlpoolClient(ctx);

    info('Initialized whirlpool client');
    info('RPC Endpoint:', ctx.connection.rpcEndpoint);
    info('Wallet Pubkey:', ctx.wallet.publicKey.toBase58());
  }

  return _whirlpoolClient;
}
