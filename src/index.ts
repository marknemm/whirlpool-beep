import env from '@/util/env'; // Load and validate env variables ASAP

import { getTokenMetaPair } from '@/services/token/query';
import { getBalance } from '@/services/wallet/get-balance';
import { getPrice } from '@/services/whirlpool/get-price';
import { getWhirlpool } from '@/services/whirlpool/get-whirlpool';
import { debug, error } from '@/util/log';
import whirlpoolClient from '@/util/whirlpool';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Main entry point.
 */
async function main() {
  try {
    debug('Environment variables loaded and validated:', { ...env });

    // Fetch token metadata (will throw error if tokens are not found)
    const [tokenAMeta, tokenBMeta] = await getTokenMetaPair(env.TOKEN_A, env.TOKEN_B);

    // Check wallet account balance
    await getBalance();

    const whirlpool = await getWhirlpool({
      tickSpacing: env.TICK_SPACING,
      tokenAMeta,
      tokenBMeta,
    });

    // Check price of whirlpool
    await getPrice(whirlpool);

    const tickArrayPublicKey = PDAUtil.getTickArray(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      new PublicKey(whirlpool.getAddress()),
      0
    ).publicKey;

    const tickArray = await whirlpoolClient().getContext().fetcher.getTickArray(tickArrayPublicKey);
    tickArray?.ticks[0];

    debug('tickArrayPublicKey', tickArrayPublicKey.toBase58());

    // Open a position in whirlpool
    // openPosition(whirlpool, Percentage.fromFraction(5, 100), new Decimal(3));
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
