import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import type { WhirlpoolArgs, WhirlpoolClientExt } from '@/interfaces/whirlpool';
import { anchor } from '@/util/anchor';
import { debug, info } from '@/util/log';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolContext, buildWhirlpoolClient } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Singleton {@link WhirlpoolClientExt} for interacting with Whirlpool accounts on Solana.
 *
 * Initialized via {@link whirlpoolClient}.
 */
let client: WhirlpoolClientExt;

/**
 * Initializes and gets a singleton {@link whirlpoolClientExt} for interacting with Whirlpool accounts on Solana.
 *
 * `Note`: Must be invoked after writing the wallet JSON file.
 *
 * @return The singleton {@link WhirlpoolClientExt}.
 */
export function whirlpoolClient(): WhirlpoolClientExt {
  if (!client) { // Enforce singleton
    // Initialize WhirlpoolClient with AnchorProvider which reads wallet pk in wallet.json.

    const ctx = WhirlpoolContext.withProvider(anchor, ORCA_WHIRLPOOL_PROGRAM_ID);

    // Build base WhirlpoolClient and assign custom extension methods
    client = Object.assign(buildWhirlpoolClient(ctx), {

      getPoolViaPDA: (args: WhirlpoolArgs) => {
        debug('Whirlpool args:');
        debug(args);

        const whirlpoolPublicKey = PDAUtil.getWhirlpool(
          ORCA_WHIRLPOOL_PROGRAM_ID,
          args.whirlpoolConfigKey ?? WHIRLPOOL_CONFIG_PUBLIC_KEY,
          new PublicKey(args.tokenAMeta.address),
          new PublicKey(args.tokenBMeta.address),
          args.tickSpacing
        ).publicKey;

        info('Retrieving whirlpool with public key: %s', whirlpoolPublicKey.toBase58());
        return client.getPool(whirlpoolPublicKey);
      }

    } as WhirlpoolClientExt);

    info('Initialized whirlpool client');
    info('RPC Endpoint: %s', ctx.connection.rpcEndpoint);
    info('Wallet Pubkey: %s', ctx.wallet.publicKey.toBase58());
  }

  return client;
}
