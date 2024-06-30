import env from '@/util/env'; // Load and validate env variables ASAP

import { getTokenMetaPair } from '@/services/token/query';
import { getBalance } from '@/services/wallet/get-balance';
import { getPrice } from '@/services/whirlpool/get-price';
import { debug, error, logEnv } from '@/util/log';
import whirlpoolClient from '@/util/whirlpool';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Main entry point.
 */
async function main() {
  try {
    logEnv();

    // Fetch token metadata (will throw error if tokens are not found)
    const [tokenAMeta, tokenBMeta] = await getTokenMetaPair();

    // Check wallet account balance
    await getBalance();

    // Check price of whirlpool
    const { whirlpool } = await getPrice({
      tickSpacing: env.TICK_SPACING,
      tokenAMeta,
      tokenBMeta,
    });

    const tickArrayPublicKey = PDAUtil.getTickArray(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      new PublicKey(whirlpool.getAddress()),
      0
    ).publicKey;

    const tickArray = await whirlpoolClient().getContext().fetcher.getTickArray(tickArrayPublicKey);
    tickArray?.ticks[0];

    debug('tickArrayPublicKey', tickArrayPublicKey.toBase58());

    // Open a position in whirlpool
    // openPosition({
    //   tickSpacing: env.TICK_SPACING,
    //   tokenAMeta,
    //   tokenBMeta,
    // }, Percentage.fromFraction(5, 100), new Decimal(3));
  } catch (err) {
    error(err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
