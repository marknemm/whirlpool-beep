import anchor from '@/util/anchor';
import { info } from '@/util/log';
import { ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolContext, buildWhirlpoolClient, type WhirlpoolClient } from '@orca-so/whirlpools-sdk';

let _whirlpoolClient: WhirlpoolClient;

/**
 * Gets the singleton {@link WhirlpoolClient}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link WhirlpoolClient} singleton.
 */
export default function whirlpoolClient(): WhirlpoolClient {
  if (!_whirlpoolClient) {
    const ctx = WhirlpoolContext.withProvider(anchor(), ORCA_WHIRLPOOL_PROGRAM_ID);

    _whirlpoolClient = buildWhirlpoolClient(ctx);

    info('-- Initialized Whirlpool Client --');
  }

  return _whirlpoolClient;
}
