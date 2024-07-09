import env from '@/util/env'; // Load and validate env variables ASAP

import { increaseLiquidity } from '@/services/position/increase-liquidity';
import { openPosition } from '@/services/position/open-position';
import { debug, error } from '@/util/log';
import { getTokenPair } from '@/util/token';
import { getWhirlpool } from '@/util/whirlpool';
import { Percentage } from '@orca-so/common-sdk';

/**
 * Main entry point.
 */
async function main() {
  debug('Environment variables loaded and validated:', { ...env });

  const [tokenA, tokenB] = await getTokenPair(env.TOKEN_A, env.TOKEN_B); // throws error if not found

  const whirlpool = await getWhirlpool(tokenA.mint.publicKey, tokenB.mint.publicKey, env.TICK_SPACING);

  const bundledPosition = await openPosition(whirlpool, Percentage.fromFraction(3, 100));
  await increaseLiquidity(bundledPosition.position, 100); // 100 Token B
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
