import env from '@/util/env'; // Load and validate env variables ASAP

import { closePosition } from '@/services/position/close-position';
import { getPositions } from '@/services/position/get-position';
import { debug, error } from '@/util/log';
import { toPriceRange } from '@/util/number-conversion';
import whirlpoolClient, { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool';
import { Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE } from '@orca-so/whirlpools-sdk';
import { openPosition } from './services/position/open-position';
import { increaseLiquidity } from './services/position/increase-liquidity';

/**
 * Main entry point.
 */
async function main() {
  debug('Environment variables loaded and validated:', { ...env });

  const priceRangeMargin = Percentage.fromFraction(1, 5);
  const bundledPositions = await getPositions(IGNORE_CACHE);

  for (const bundledPosition of bundledPositions) {
    const { position } = bundledPosition;
    const { tickLowerIndex, tickUpperIndex } = position.getData();
    const whirlpoolData = position.getWhirlpoolData();
    const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);

    const whirlpoolPrice = await getWhirlpoolPrice(whirlpoolData);
    const [priceLower, priceUpper] = toPriceRange(
      [tickLowerIndex, tickUpperIndex],
      [tokenA.mint.decimals, tokenB.mint.decimals]
    );
    const priceRangeSize = priceUpper.minus(priceLower);
    const priceRangeMarginSize = priceRangeSize.mul(priceRangeMargin.toDecimal());
    const bufferedPriceLower = priceLower.plus(priceRangeMarginSize);
    const bufferedPriceUpper = priceUpper.minus(priceRangeMarginSize);

    if (whirlpoolPrice.lt(bufferedPriceLower) || whirlpoolPrice.gt(bufferedPriceUpper)) {
      await closePosition(bundledPosition);
      const whirlpool = await whirlpoolClient().getPool(position.getData().whirlpool);
      const newBundledPosition = await openPosition(whirlpool, Percentage.fromFraction(3, 100));
      await increaseLiquidity(newBundledPosition.position, 10);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    error(err);
    process.exit(1);
  });
